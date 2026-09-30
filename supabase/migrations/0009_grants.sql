-- Explicit table/view grants for anon and authenticated.
--
-- A fresh Supabase project pre-configures default privileges so anon and
-- authenticated already get SELECT etc. on public-schema objects you
-- create — which is why this often "just works" without a migration like
-- this one. This file makes that dependency explicit rather than relying
-- on it silently, so the schema is correct even if that default privilege
-- setup is ever missing or changed. RLS policies (migration 0006) still
-- do the real per-row restriction — these grants only control which
-- commands a role may attempt at all.

-- Public, unauthenticated browsing.
grant select on public.items_public to anon, authenticated;
grant select on public.categories to anon, authenticated;
grant select on public.item_images to anon, authenticated;
grant select on public.order_batches to anon, authenticated;
grant select on public.settings to anon, authenticated;

-- Signed-in students. RLS restricts these to the student's own rows;
-- admin bypasses RLS via is_admin() but still needs the grant.
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.cart_items to authenticated;
grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;

-- Admin-managed tables. Table-level grant is broad; the "*_admin_*" RLS
-- policies in migration 0006 are what actually restrict writes (and, for
-- vendors/items/promotions, all access) to admins.
grant select, insert, update, delete on public.vendors to authenticated;
grant select, insert, update, delete on public.items to authenticated;
grant insert, update, delete on public.categories to authenticated;
grant insert, update, delete on public.order_batches to authenticated;
grant insert, update, delete on public.item_images to authenticated;
grant select, insert, update, delete on public.promotions to authenticated;
grant insert, update, delete on public.settings to authenticated;
grant insert, update, delete on public.orders to authenticated;
grant insert, update, delete on public.order_items to authenticated;
