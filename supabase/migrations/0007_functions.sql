-- Pricing and checkout functions. The server is the source of truth for
-- prices: this file is the only place a price is ever computed for a real
-- order. The frontend must never send a price and have it trusted.

-- compute_item_price ---------------------------------------------------
-- Given an item and an optional promo code, returns the best price a
-- student would pay for that item right now, and which discount produced
-- it (if any). "Best deal wins" — an item's own sale price, an automatic
-- (no-code) promotion, and an entered promo code are all compared, and
-- the lowest resulting price is used. They do not stack.
create or replace function public.compute_item_price(
  p_item_id uuid,
  p_promo_code text default null
)
returns table (
  base_price_ghs numeric(10, 2),
  unit_price_ghs numeric(10, 2),
  discount_ghs numeric(10, 2),
  is_on_sale boolean,
  promo_id uuid,
  promo_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_item public.items%rowtype;
  v_item_sale_price numeric(10, 2);
  v_best_price numeric(10, 2);
  v_best_promo_id uuid;
  v_best_promo_name text;
  v_is_sale boolean := false;
  v_candidate numeric(10, 2);
  v_promo record;
begin
  select * into v_item from public.items where id = p_item_id;
  if not found then
    raise exception 'Item % not found', p_item_id;
  end if;

  v_best_price := v_item.base_price_ghs;

  -- the item's own sale price, if currently active
  if v_item.sale_price_ghs is not null
    and (v_item.sale_starts_at is null or v_item.sale_starts_at <= now())
    and (v_item.sale_ends_at is null or v_item.sale_ends_at >= now())
    and v_item.sale_price_ghs < v_best_price
  then
    v_best_price := v_item.sale_price_ghs;
    v_is_sale := true;
    v_best_promo_id := null;
  end if;

  -- best automatic (no-code) promotion applicable to this item
  for v_promo in
    select * from public.promotions
    where is_active
      and code is null
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at >= now())
      and (
        scope = 'all'
        or (scope = 'category' and scope_category_id = v_item.category_id)
        or (scope = 'items' and v_item.id = any (scope_item_ids))
      )
  loop
    v_candidate := case
      when v_promo.type = 'percent' then v_item.base_price_ghs * (1 - v_promo.value / 100)
      else v_item.base_price_ghs - v_promo.value
    end;
    v_candidate := greatest(v_candidate, 0);
    if v_candidate < v_best_price then
      v_best_price := v_candidate;
      v_is_sale := false;
      v_best_promo_id := v_promo.id;
      v_best_promo_name := v_promo.name;
    end if;
  end loop;

  -- an entered promo code, if it applies to this item
  if p_promo_code is not null then
    select * into v_promo from public.promotions
    where is_active
      and code = p_promo_code
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at >= now())
      and (
        scope = 'all'
        or (scope = 'category' and scope_category_id = v_item.category_id)
        or (scope = 'items' and v_item.id = any (scope_item_ids))
      );
    if found then
      v_candidate := case
        when v_promo.type = 'percent' then v_item.base_price_ghs * (1 - v_promo.value / 100)
        else v_item.base_price_ghs - v_promo.value
      end;
      v_candidate := greatest(v_candidate, 0);
      if v_candidate < v_best_price then
        v_best_price := v_candidate;
        v_is_sale := false;
        v_best_promo_id := v_promo.id;
        v_best_promo_name := v_promo.name;
      end if;
    end if;
  end if;

  return query select
    v_item.base_price_ghs,
    v_best_price,
    v_item.base_price_ghs - v_best_price,
    v_is_sale,
    v_best_promo_id,
    v_best_promo_name;
end;
$$;

-- get_effective_prices --------------------------------------------------
-- Display-only batch version, for the catalog/product pages. Callable by
-- anyone (browsing is public) without exposing the promotions table.
create or replace function public.get_effective_prices(
  p_item_ids uuid[],
  p_promo_code text default null
)
returns table (
  item_id uuid,
  base_price_ghs numeric(10, 2),
  unit_price_ghs numeric(10, 2),
  discount_ghs numeric(10, 2),
  is_on_sale boolean,
  promo_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select id, p.base_price_ghs, p.unit_price_ghs, p.discount_ghs, p.is_on_sale, p.promo_name
  from unnest(p_item_ids) as id
  cross join lateral public.compute_item_price(id, p_promo_code) as p;
end;
$$;

grant execute on function public.get_effective_prices(uuid[], text) to anon, authenticated;

-- expire_stale_holds ------------------------------------------------------
-- Releases items whose 24-hour payment hold has passed. Called lazily at
-- the top of checkout() (guaranteed correctness even without pg_cron) and
-- scheduled via pg_cron below when the extension is available on this
-- project.
create or replace function public.expire_stale_holds()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.items
  set status = 'available'
  where status = 'reserved'
    and id in (
      select oi.item_id
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where o.status = 'awaiting_payment'
        and o.hold_expires_at < now()
    );

  update public.orders
  set status = 'expired'
  where status = 'awaiting_payment'
    and hold_expires_at < now();
end;
$$;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.schedule(
        'expire-stale-holds',
        '*/15 * * * *',
        $cron$select public.expire_stale_holds();$cron$
      );
    exception when others then
      raise notice 'pg_cron scheduling skipped (%): falling back to the lazy check in checkout()', sqlerrm;
    end;
  else
    raise notice 'pg_cron not available on this project: relying on the lazy check in checkout()';
  end if;
end $$;

-- checkout ------------------------------------------------------------
-- Atomically reserves every item in a student's cart selection, applies
-- the best price/promo per item, and creates one order covering all of
-- them. All-or-nothing: if any item has been taken since the student last
-- saw it, nothing is reserved and the function reports exactly which
-- item(s) to remove.
create or replace function public.checkout(
  p_batch_id uuid,
  p_item_ids uuid[],
  p_promo_code text default null
)
returns table (
  order_id uuid,
  subtotal_ghs numeric(10, 2),
  discount_total_ghs numeric(10, 2),
  delivery_fee_ghs numeric(10, 2),
  total_ghs numeric(10, 2),
  hold_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid := auth.uid();
  v_item_id uuid;
  v_item public.items%rowtype;
  v_price record;
  v_subtotal numeric(10, 2) := 0;
  v_discount numeric(10, 2) := 0;
  v_delivery_fee numeric(10, 2);
  v_order_id uuid;
  v_unavailable text[] := '{}';
begin
  if v_student_id is null then
    raise exception 'Must be signed in to check out.' using errcode = '28000';
  end if;

  if p_item_ids is null or array_length(p_item_ids, 1) is null then
    raise exception 'Cart is empty.';
  end if;

  -- release any expired holds first, so a stale reservation doesn't
  -- wrongly block this checkout
  perform public.expire_stale_holds();

  -- lock the batch and make sure it's still accepting orders
  perform 1 from public.order_batches
    where id = p_batch_id and status = 'open' and closes_at > now()
    for update;
  if not found then
    raise exception 'That pickup batch is no longer open for orders.';
  end if;

  -- lock every item row (deterministic order avoids deadlocks between
  -- concurrent checkouts sharing items) and check availability
  for v_item_id in select unnest(p_item_ids) order by 1
  loop
    select * into v_item from public.items where id = v_item_id for update;
    if not found or v_item.status <> 'available' then
      v_unavailable := array_append(v_unavailable, coalesce(v_item.title, v_item_id::text));
    end if;
  end loop;

  if array_length(v_unavailable, 1) > 0 then
    raise exception 'No longer available: %. Remove and try again.', array_to_string(v_unavailable, ', ');
  end if;

  select coalesce((value #>> '{}')::numeric, 0) into v_delivery_fee
  from public.settings where key = 'delivery_fee_ghs';
  v_delivery_fee := coalesce(v_delivery_fee, 0);

  insert into public.orders (
    student_id, batch_id, subtotal_ghs, discount_total_ghs,
    delivery_fee_ghs, total_ghs, status, promo_code, hold_expires_at
  ) values (
    v_student_id, p_batch_id, 0, 0, v_delivery_fee, 0, 'awaiting_payment',
    p_promo_code, now() + interval '24 hours'
  ) returning id into v_order_id;

  foreach v_item_id in array p_item_ids
  loop
    select * into v_price from public.compute_item_price(v_item_id, p_promo_code);
    select * into v_item from public.items where id = v_item_id;

    insert into public.order_items (order_id, item_id, price_paid_ghs, title_snapshot)
    values (v_order_id, v_item_id, v_price.unit_price_ghs, v_item.title);

    update public.items set status = 'reserved' where id = v_item_id;

    v_subtotal := v_subtotal + v_price.base_price_ghs;
    v_discount := v_discount + v_price.discount_ghs;
  end loop;

  update public.orders
  set subtotal_ghs = v_subtotal,
      discount_total_ghs = v_discount,
      total_ghs = v_subtotal - v_discount + v_delivery_fee
  where id = v_order_id;

  delete from public.cart_items
  where student_id = v_student_id and item_id = any (p_item_ids);

  return query
  select v_order_id, v_subtotal, v_discount, v_delivery_fee,
         v_subtotal - v_discount + v_delivery_fee, (now() + interval '24 hours');
end;
$$;

grant execute on function public.checkout(uuid, uuid[], text) to authenticated;
