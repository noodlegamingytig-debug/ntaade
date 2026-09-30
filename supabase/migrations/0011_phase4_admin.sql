-- Phase 4: admin tooling. Safe to re-run.
-- Every function here checks public.is_admin() itself, so even though they are
-- SECURITY DEFINER (needed to read auth.users / touch several tables atomically)
-- a student calling them gets "Not authorized" and nothing else.

-- 1. Storage: bucket + admin-only write policies ---------------------------
-- (Replaces the manual dashboard steps from the Phase 1 README.)
insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', true)
on conflict (id) do update set public = true;

drop policy if exists "item_images_admin_insert" on storage.objects;
create policy "item_images_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'item-images' and public.is_admin());

drop policy if exists "item_images_admin_update" on storage.objects;
create policy "item_images_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'item-images' and public.is_admin())
  with check (bucket_id = 'item-images' and public.is_admin());

drop policy if exists "item_images_admin_delete" on storage.objects;
create policy "item_images_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'item-images' and public.is_admin());

-- 2. Admin order list (joins the student's name/phone/email + line items) -----
create or replace function public.admin_list_orders(
  p_batch_id uuid default null,
  p_status text default null
)
returns table (
  id uuid,
  created_at timestamptz,
  status text,
  payment_reference text,
  promo_code text,
  subtotal_ghs numeric(10, 2),
  discount_total_ghs numeric(10, 2),
  delivery_fee_ghs numeric(10, 2),
  total_ghs numeric(10, 2),
  hold_expires_at timestamptz,
  batch_id uuid,
  student_name text,
  student_phone text,
  student_email text,
  items jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  return query
  select
    o.id, o.created_at, o.status, o.payment_reference, o.promo_code,
    o.subtotal_ghs, o.discount_total_ghs, o.delivery_fee_ghs, o.total_ghs,
    o.hold_expires_at, o.batch_id,
    p.full_name, p.phone, u.email::text,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'item_id', oi.item_id,
        'title', oi.title_snapshot,
        'price', oi.price_paid_ghs,
        'vendor', v.code_name
      ) order by oi.title_snapshot)
      from public.order_items oi
      left join public.items i on i.id = oi.item_id
      left join public.vendors v on v.id = i.vendor_id
      where oi.order_id = o.id
    ), '[]'::jsonb)
  from public.orders o
  join public.profiles p on p.id = o.student_id
  left join auth.users u on u.id = o.student_id
  where (p_batch_id is null or o.batch_id = p_batch_id)
    and (p_status is null or o.status = p_status)
  order by o.created_at desc;
end;
$$;

revoke execute on function public.admin_list_orders(uuid, text) from public, anon;
grant execute on function public.admin_list_orders(uuid, text) to authenticated;

-- 3. Order status transitions ------------------------------------------------
-- awaiting_payment -> paid | cancelled
-- paid             -> delivered | refunded | cancelled
-- delivered        -> refunded
-- expired          -> paid   (student paid after the hold lapsed: re-claims the
--                             items, but only if nobody else has taken them)
-- Item side effects:
--   paid       : items become 'sold'
--   cancelled  : items go back to 'available'
--   refunded   : items go back to 'available' unless the order was already
--                delivered (the piece has left; hide/relist it by hand if returned)
create or replace function public.admin_set_order_status(
  p_order_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item_ids uuid[];
  v_bad text[];
begin
  if not public.is_admin() then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found.';
  end if;

  if not (
    (v_order.status = 'awaiting_payment' and p_status in ('paid', 'cancelled'))
    or (v_order.status = 'paid' and p_status in ('delivered', 'refunded', 'cancelled'))
    or (v_order.status = 'delivered' and p_status = 'refunded')
    or (v_order.status = 'expired' and p_status = 'paid')
  ) then
    raise exception 'An order that is % cannot be changed to %.', v_order.status, p_status;
  end if;

  select coalesce(array_agg(item_id), '{}') into v_item_ids
  from public.order_items where order_id = p_order_id;

  if v_order.status = 'expired' and p_status = 'paid' then
    -- lock and verify every item is still free
    select coalesce(array_agg(i.title), '{}') into v_bad
    from public.items i
    where i.id = any (v_item_ids) and i.status <> 'available';
    if array_length(v_bad, 1) > 0 then
      raise exception 'Cannot restore this order, already gone: %.', array_to_string(v_bad, ', ');
    end if;
    perform 1 from public.items where id = any (v_item_ids) order by id for update;
  end if;

  if p_status = 'paid' then
    update public.items set status = 'sold' where id = any (v_item_ids);
  elsif p_status = 'cancelled'
     or (p_status = 'refunded' and v_order.status <> 'delivered') then
    update public.items set status = 'available'
    where id = any (v_item_ids) and status in ('reserved', 'sold');
  end if;

  update public.orders set status = p_status where id = p_order_id;
end;
$$;

revoke execute on function public.admin_set_order_status(uuid, text) from public, anon;
grant execute on function public.admin_set_order_status(uuid, text) to authenticated;

-- 4. Reject a payment reference (wrong/typo/no money) so the student can resubmit
create or replace function public.admin_reject_payment(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if v_order.status <> 'awaiting_payment' or v_order.payment_reference is null then
    raise exception 'This order has no pending payment reference to reject.';
  end if;
  -- give the student a fresh 24h to pay properly
  update public.orders
  set payment_reference = null,
      hold_expires_at = greatest(hold_expires_at, now() + interval '24 hours')
  where id = p_order_id;
end;
$$;

revoke execute on function public.admin_reject_payment(uuid) from public, anon;
grant execute on function public.admin_reject_payment(uuid) to authenticated;

-- 5. Delete a category safely -------------------------------------------------
-- Refuses if items still use it (unless a replacement category is given, in which
-- case items and sub-categories move there) or if a promotion is scoped to it
-- (deleting the category would silently delete that promotion).
create or replace function public.admin_delete_category(
  p_category_id uuid,
  p_reassign_to uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items integer;
  v_children integer;
  v_promos integer;
begin
  if not public.is_admin() then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;
  if p_reassign_to = p_category_id then
    raise exception 'Choose a different category to move items into.';
  end if;

  select count(*) into v_promos from public.promotions where scope_category_id = p_category_id;
  if v_promos > 0 then
    raise exception 'A promotion is scoped to this category. End or edit that promotion first.';
  end if;

  select count(*) into v_items from public.items where category_id = p_category_id;
  select count(*) into v_children from public.categories where parent_id = p_category_id;

  if (v_items > 0 or v_children > 0) and p_reassign_to is null then
    raise exception 'This category has % item(s) and % sub-categor(ies). Pick a category to move them into, or hide the category instead.',
      v_items, v_children;
  end if;

  if p_reassign_to is not null then
    update public.items set category_id = p_reassign_to where category_id = p_category_id;
    update public.categories set parent_id = p_reassign_to where parent_id = p_category_id;
  end if;

  delete from public.categories where id = p_category_id;
end;
$$;

revoke execute on function public.admin_delete_category(uuid, uuid) from public, anon;
grant execute on function public.admin_delete_category(uuid, uuid) to authenticated;

-- 6. Bulk percentage discount --------------------------------------------------
-- Sets each item's own sale price to base * (1 - percent/100). percent = 0 clears it.
create or replace function public.admin_apply_percent_discount(
  p_item_ids uuid[],
  p_percent numeric,
  p_ends_at timestamptz default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;
  if p_percent < 0 or p_percent >= 100 then
    raise exception 'Discount must be between 0 and 99 percent.';
  end if;

  if p_percent = 0 then
    update public.items
    set sale_price_ghs = null, sale_starts_at = null, sale_ends_at = null
    where id = any (p_item_ids);
  else
    update public.items
    set sale_price_ghs = round(base_price_ghs * (1 - p_percent / 100), 2),
        sale_starts_at = null,
        sale_ends_at = p_ends_at
    where id = any (p_item_ids);
  end if;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.admin_apply_percent_discount(uuid[], numeric, timestamptz) from public, anon;
grant execute on function public.admin_apply_percent_discount(uuid[], numeric, timestamptz) to authenticated;

-- 7. Promotion preview: which items would this hit, and at what price? ----------
-- Mirrors the discount maths in compute_item_price for a single hypothetical promotion.
create or replace function public.admin_preview_promotion(
  p_type text,
  p_value numeric,
  p_scope text,
  p_category_id uuid default null,
  p_item_ids uuid[] default null
)
returns table (
  item_id uuid,
  title text,
  base_price_ghs numeric(10, 2),
  current_price_ghs numeric(10, 2),
  promo_price_ghs numeric(10, 2),
  beats_current boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  return query
  select
    i.id,
    i.title,
    i.base_price_ghs,
    e.unit_price_ghs,
    x.price,
    x.price < e.unit_price_ghs
  from public.items i
  cross join lateral public.compute_item_price(i.id, null) e
  cross join lateral (
    select greatest(
      round(case when p_type = 'percent'
                 then i.base_price_ghs * (1 - p_value / 100)
                 else i.base_price_ghs - p_value end, 2), 0) as price
  ) x
  where i.status = 'available'
    and (
      p_scope = 'all'
      or (p_scope = 'category' and i.category_id = p_category_id)
      or (p_scope = 'items' and i.id = any (p_item_ids))
    )
  order by i.title;
end;
$$;

revoke execute on function public.admin_preview_promotion(text, numeric, text, uuid, uuid[]) from public, anon;
grant execute on function public.admin_preview_promotion(text, numeric, text, uuid, uuid[]) to authenticated;
