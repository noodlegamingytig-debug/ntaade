-- Public-safe view over items. Students (and anonymous visitors, since
-- browsing is public) read through this view instead of the items table
-- directly, so vendor_id and vendor details are never exposed.
--
-- This also resolves the "current" price (accounting for an active sale)
-- so the frontend doesn't have to duplicate that date-range logic — the
-- authoritative price check at checkout still happens server-side in the
-- checkout() function (migration 0007), this is only for display.

create or replace view public.items_public as
select
  i.id,
  i.title,
  i.description,
  i.category_id,
  c.name as category_name,
  c.slug as category_slug,
  i.department,
  i.size,
  i.measurements,
  i.condition_grade,
  i.base_price_ghs,
  case
    when i.sale_price_ghs is not null
      and (i.sale_starts_at is null or i.sale_starts_at <= now())
      and (i.sale_ends_at is null or i.sale_ends_at >= now())
    then i.sale_price_ghs
    else i.base_price_ghs
  end as current_price_ghs,
  (
    i.sale_price_ghs is not null
      and (i.sale_starts_at is null or i.sale_starts_at <= now())
      and (i.sale_ends_at is null or i.sale_ends_at >= now())
  ) as is_on_sale,
  i.status,
  i.created_at,
  i.expires_at
from public.items i
left join public.categories c on c.id = i.category_id
where i.status = 'available';

-- item_images has no sensitive columns, so students can select from it
-- directly (scoped by RLS in migration 0006) rather than needing a view.
