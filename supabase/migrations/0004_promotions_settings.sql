-- promotions, settings.

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('percent', 'fixed')),
  value numeric(10, 2) not null check (value >= 0),
  scope text not null check (scope in ('all', 'category', 'items')),
  scope_category_id uuid references public.categories(id) on delete cascade,
  scope_item_ids uuid[],
  code text unique,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint promotions_scope_category_requires_id
    check (scope <> 'category' or scope_category_id is not null),
  constraint promotions_scope_items_requires_ids
    check (scope <> 'items' or (scope_item_ids is not null and array_length(scope_item_ids, 1) > 0))
);

create index promotions_code_idx on public.promotions(code) where code is not null;
create index promotions_is_active_idx on public.promotions(is_active);

-- settings ------------------------------------------------------------
-- Simple admin-editable key/value store, e.g. { "key": "delivery_fee_ghs",
-- "value": 0 }. Values are jsonb so different settings can hold numbers,
-- strings, or small objects without new columns/migrations.
create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.settings (key, value)
values ('delivery_fee_ghs', '0'::jsonb)
on conflict (key) do nothing;
