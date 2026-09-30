-- Phase 3 support: security fixes, cart/payment functions, and settings.
-- Safe to re-run (create or replace / if not exists / on conflict do nothing).

-- 1. SECURITY FIX ------------------------------------------------------
-- The "profiles_update_own_or_admin" RLS policy lets a student update their own
-- profile row, and nothing restricted WHICH columns. A student could therefore run
--   update profiles set role = 'admin' where id = auth.uid();
-- and promote themselves. Fix with column-level privileges: signed-in users may only
-- update full_name and phone. (Roles are changed from the SQL editor, as in the README.)
-- Supabase grants broad default privileges to anon/authenticated on new tables, so we
-- revoke everything first and grant back only what is needed.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- 2. Internal functions must not be callable straight from the API --------
-- (they are still used by the SECURITY DEFINER functions below, which run as owner)
revoke execute on function public.compute_item_price(uuid, text) from public, anon, authenticated;
revoke execute on function public.expire_stale_holds() from public, anon, authenticated;

-- 3. Promo codes are stored upper-case so matching is case-insensitive ------
update public.promotions set code = upper(code) where code is not null and code <> upper(code);
alter table public.promotions drop constraint if exists promotions_code_uppercase;
alter table public.promotions
  add constraint promotions_code_uppercase check (code is null or code = upper(code));

-- 4. A student must be able to see the batch their own order belongs to, even after
-- it closes (the existing policy only exposes open batches).
drop policy if exists "order_batches_select_own_orders" on public.order_batches;
create policy "order_batches_select_own_orders"
  on public.order_batches for select
  using (
    exists (
      select 1 from public.orders o
      where o.batch_id = order_batches.id and o.student_id = auth.uid()
    )
  );

-- 5. Payment instructions shown at checkout (admin edits these in Phase 4) ---
insert into public.settings (key, value) values
  ('payment_network', to_jsonb('MTN MoMo'::text)),
  ('payment_number', to_jsonb('0XX XXX XXXX'::text)),
  ('payment_account_name', to_jsonb('Ntaade'::text))
on conflict (key) do nothing;

-- 6. One payment reference can only ever be used on one order --------------
create unique index if not exists orders_payment_reference_unique
  on public.orders (upper(payment_reference))
  where payment_reference is not null;

-- 7. Hold expiry: never auto-expire an order the student has already paid for --
-- (they submitted a payment reference; an admin must confirm or reject it).
create or replace function public.expire_stale_holds()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with expired as (
    update public.orders
    set status = 'expired'
    where status = 'awaiting_payment'
      and hold_expires_at < now()
      and payment_reference is null
    returning id
  )
  update public.items
  set status = 'available'
  where status = 'reserved'
    and id in (
      select oi.item_id from public.order_items oi
      where oi.order_id in (select id from expired)
    );
end;
$$;

-- 8. Cart display: works for guests too, and still shows items that have since been
-- reserved/sold (students cannot read the items table directly).
create or replace function public.get_cart_lines(
  p_item_ids uuid[],
  p_promo_code text default null
)
returns table (
  item_id uuid,
  title text,
  size text,
  condition_grade text,
  is_available boolean,
  image_path text,
  base_price_ghs numeric(10, 2),
  unit_price_ghs numeric(10, 2),
  discount_ghs numeric(10, 2),
  promo_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id,
    i.title,
    i.size,
    i.condition_grade,
    (i.status = 'available'),
    (select im.storage_path from public.item_images im
      where im.item_id = i.id order by im.position limit 1),
    p.base_price_ghs,
    p.unit_price_ghs,
    p.discount_ghs,
    p.promo_name
  from unnest(p_item_ids) as ids(id)
  join public.items i on i.id = ids.id
  cross join lateral public.compute_item_price(i.id, upper(nullif(trim(p_promo_code), ''))) p;
$$;

grant execute on function public.get_cart_lines(uuid[], text) to anon, authenticated;

-- 9. Is this promo code real and currently active? (returns no row if not) ----
create or replace function public.check_promo_code(p_code text)
returns table (promo_name text)
language sql
stable
security definer
set search_path = public
as $$
  select pr.name
  from public.promotions pr
  where pr.is_active
    and pr.code = upper(trim(p_code))
    and (pr.starts_at is null or pr.starts_at <= now())
    and (pr.ends_at is null or pr.ends_at >= now())
  limit 1;
$$;

grant execute on function public.check_promo_code(text) to anon, authenticated;

-- 10. checkout(): same as before, plus de-duplication of item ids, promo code
-- normalisation, and only recording a promo code that is actually valid.
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
  v_ids uuid[];
  v_item_id uuid;
  v_item public.items%rowtype;
  v_price record;
  v_subtotal numeric(10, 2) := 0;
  v_discount numeric(10, 2) := 0;
  v_delivery_fee numeric(10, 2);
  v_order_id uuid;
  v_unavailable text[] := '{}';
  v_code text := upper(nullif(trim(p_promo_code), ''));
  v_expires timestamptz := now() + interval '24 hours';
begin
  if v_student_id is null then
    raise exception 'Must be signed in to check out.' using errcode = '28000';
  end if;

  -- de-duplicate, keep a deterministic lock order
  select coalesce(array_agg(distinct x order by x), '{}') into v_ids
  from unnest(p_item_ids) as t(x);

  if array_length(v_ids, 1) is null then
    raise exception 'Cart is empty.';
  end if;

  perform public.expire_stale_holds();

  perform 1 from public.order_batches
    where id = p_batch_id and status = 'open' and closes_at > now()
    for update;
  if not found then
    raise exception 'That pickup batch is no longer open for orders.';
  end if;

  if v_code is not null and not exists (select 1 from public.check_promo_code(v_code)) then
    v_code := null; -- unknown/expired code: ignore it rather than record it
  end if;

  foreach v_item_id in array v_ids
  loop
    select * into v_item from public.items where id = v_item_id for update;
    if not found or v_item.status <> 'available' then
      v_unavailable := array_append(v_unavailable, coalesce(v_item.title, v_item_id::text));
    end if;
  end loop;

  if array_length(v_unavailable, 1) > 0 then
    raise exception 'No longer available: %. Remove and try again.',
      array_to_string(v_unavailable, ', ');
  end if;

  select coalesce((value #>> '{}')::numeric, 0) into v_delivery_fee
  from public.settings where key = 'delivery_fee_ghs';
  v_delivery_fee := coalesce(v_delivery_fee, 0);

  insert into public.orders (
    student_id, batch_id, subtotal_ghs, discount_total_ghs,
    delivery_fee_ghs, total_ghs, status, promo_code, hold_expires_at
  ) values (
    v_student_id, p_batch_id, 0, 0, v_delivery_fee, 0, 'awaiting_payment',
    v_code, v_expires
  ) returning id into v_order_id;

  foreach v_item_id in array v_ids
  loop
    select * into v_price from public.compute_item_price(v_item_id, v_code);
    select * into v_item from public.items where id = v_item_id;

    insert into public.order_items (order_id, item_id, price_paid_ghs, title_snapshot)
    values (v_order_id, v_item_id, v_price.unit_price_ghs, v_item.title);

    update public.items set status = 'reserved' where id = v_item_id;

    v_subtotal := v_subtotal + v_price.base_price_ghs;
    v_discount := v_discount + v_price.discount_ghs;
  end loop;

  update public.orders o
  set subtotal_ghs = v_subtotal,
      discount_total_ghs = v_discount,
      total_ghs = v_subtotal - v_discount + v_delivery_fee
  where o.id = v_order_id;

  delete from public.cart_items c
  where c.student_id = v_student_id and c.item_id = any (v_ids);

  return query
  select v_order_id, v_subtotal, v_discount, v_delivery_fee,
         v_subtotal - v_discount + v_delivery_fee, v_expires;
end;
$$;

grant execute on function public.checkout(uuid, uuid[], text) to authenticated;

-- 11. Student submits their MoMo transaction reference -----------------------
create or replace function public.submit_payment_reference(
  p_order_id uuid,
  p_reference text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid := auth.uid();
  v_ref text := upper(trim(p_reference));
  v_order public.orders%rowtype;
begin
  if v_student_id is null then
    raise exception 'Must be signed in.' using errcode = '28000';
  end if;
  if v_ref is null or length(v_ref) < 4 or length(v_ref) > 64 then
    raise exception 'Enter the transaction reference from your mobile money confirmation.';
  end if;

  perform public.expire_stale_holds();

  select * into v_order from public.orders
  where id = p_order_id and student_id = v_student_id for update;
  if not found then
    raise exception 'Order not found.';
  end if;
  if v_order.status <> 'awaiting_payment' then
    raise exception 'This order is % and can no longer take a payment reference. Contact us if you already paid.',
      v_order.status;
  end if;

  update public.orders set payment_reference = v_ref where id = p_order_id;
exception when unique_violation then
  raise exception 'That reference has already been used on another order.';
end;
$$;

grant execute on function public.submit_payment_reference(uuid, text) to authenticated;

-- 12. Student cancels their own unpaid order, releasing the items ------------
create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid := auth.uid();
  v_order public.orders%rowtype;
begin
  if v_student_id is null then
    raise exception 'Must be signed in.' using errcode = '28000';
  end if;

  select * into v_order from public.orders
  where id = p_order_id and student_id = v_student_id for update;
  if not found then
    raise exception 'Order not found.';
  end if;
  if v_order.status <> 'awaiting_payment' then
    raise exception 'Only unpaid orders can be cancelled.';
  end if;
  if v_order.payment_reference is not null then
    raise exception 'You already submitted a payment reference. Contact us to cancel or get a refund.';
  end if;

  update public.orders set status = 'cancelled' where id = p_order_id;
  update public.items set status = 'available'
  where status = 'reserved'
    and id in (select item_id from public.order_items where order_id = p_order_id);
end;
$$;

grant execute on function public.cancel_order(uuid) to authenticated;
