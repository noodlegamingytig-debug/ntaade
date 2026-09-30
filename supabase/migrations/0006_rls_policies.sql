-- Enable Row Level Security on every table and define policies.
--
-- Two small SECURITY DEFINER helper functions are used throughout so that
-- policies can check things (an admin role, an item's availability)
-- without running into RLS recursion or cross-table RLS denial: a policy
-- on table A that subqueries table B is evaluated as the *querying user*,
-- so if that user has no RLS access to B the subquery silently returns no
-- rows. Wrapping the check in a SECURITY DEFINER function (owned by the
-- migration role, which Supabase RLS treats as bypassing RLS) avoids that.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.item_is_available(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.items
    where id = p_item_id and status = 'available'
  );
$$;

-- profiles ----------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own_or_admin"
  on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy "profiles_admin_all"
  on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());

-- vendors -------------------------------------------------------------
-- Internal only. No policy at all for students/anon means default deny.
alter table public.vendors enable row level security;

create policy "vendors_admin_all"
  on public.vendors for all
  using (public.is_admin())
  with check (public.is_admin());

-- categories ----------------------------------------------------------
alter table public.categories enable row level security;

create policy "categories_select_active_or_admin"
  on public.categories for select
  using (is_active or public.is_admin());

create policy "categories_admin_write"
  on public.categories for insert
  with check (public.is_admin());

create policy "categories_admin_update"
  on public.categories for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "categories_admin_delete"
  on public.categories for delete
  using (public.is_admin());

-- items ---------------------------------------------------------------
-- Students/anon never read this table directly — they read the
-- items_public view (migration 0005), which is owned by the migration
-- role and so bypasses this RLS by design, after already excluding
-- vendor_id and filtering to available items.
alter table public.items enable row level security;

create policy "items_admin_all"
  on public.items for all
  using (public.is_admin())
  with check (public.is_admin());

-- item_images -----------------------------------------------------------
alter table public.item_images enable row level security;

create policy "item_images_select_available_or_admin"
  on public.item_images for select
  using (public.item_is_available(item_id) or public.is_admin());

create policy "item_images_admin_write"
  on public.item_images for insert
  with check (public.is_admin());

create policy "item_images_admin_update"
  on public.item_images for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "item_images_admin_delete"
  on public.item_images for delete
  using (public.is_admin());

-- order_batches ---------------------------------------------------------
-- Anyone (including anon) can see open batches, needed to pick a pickup
-- slot during checkout before/while signing in.
alter table public.order_batches enable row level security;

create policy "order_batches_select_open_or_admin"
  on public.order_batches for select
  using (status = 'open' or public.is_admin());

create policy "order_batches_admin_write"
  on public.order_batches for insert
  with check (public.is_admin());

create policy "order_batches_admin_update"
  on public.order_batches for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "order_batches_admin_delete"
  on public.order_batches for delete
  using (public.is_admin());

-- orders ------------------------------------------------------------------
-- Students can only ever read their own orders. Orders are only ever
-- created/updated through the checkout() function (migration 0007, itself
-- SECURITY DEFINER) or by an admin — never by a direct student insert —
-- so there is deliberately no student insert/update policy here.
alter table public.orders enable row level security;

create policy "orders_select_own_or_admin"
  on public.orders for select
  using (student_id = auth.uid() or public.is_admin());

create policy "orders_admin_all"
  on public.orders for all
  using (public.is_admin())
  with check (public.is_admin());

-- order_items ---------------------------------------------------------
alter table public.order_items enable row level security;

create policy "order_items_select_own_or_admin"
  on public.order_items for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.student_id = auth.uid()
    )
  );

create policy "order_items_admin_all"
  on public.order_items for all
  using (public.is_admin())
  with check (public.is_admin());

-- cart_items ------------------------------------------------------------
-- A student's own cart. No public/anon access — guest carts live in the
-- browser only and are merged into this table on sign-in (Phase 3).
alter table public.cart_items enable row level security;

create policy "cart_items_own_or_admin"
  on public.cart_items for all
  using (student_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or public.is_admin());

-- promotions --------------------------------------------------------------
-- Admin-only table. Students never read promotion rows directly — prices
-- shown to students come from the get_effective_prices() RPC (migration
-- 0007), which applies promotions server-side without exposing them.
alter table public.promotions enable row level security;

create policy "promotions_admin_all"
  on public.promotions for all
  using (public.is_admin())
  with check (public.is_admin());

-- settings ------------------------------------------------------------
-- Readable by everyone (e.g. delivery fee shown in cart/checkout),
-- writable by admins only.
alter table public.settings enable row level security;

create policy "settings_select_all"
  on public.settings for select
  using (true);

create policy "settings_admin_write"
  on public.settings for insert
  with check (public.is_admin());

create policy "settings_admin_update"
  on public.settings for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "settings_admin_delete"
  on public.settings for delete
  using (public.is_admin());
