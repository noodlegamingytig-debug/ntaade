-- Core tables: profiles, vendors, categories, items, item_images, order_batches.

create extension if not exists pgcrypto; -- for gen_random_uuid()

-- profiles ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user is created, so the
-- app never has to remember to do this itself.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- vendors ---------------------------------------------------------------
-- Internal only. Students must never be able to read this table.
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  code_name text not null unique,
  notes text,
  created_at timestamptz not null default now()
);

-- categories --------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  parent_id uuid references public.categories(id) on delete set null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index categories_parent_id_idx on public.categories(parent_id);

-- items -------------------------------------------------------------------
create table public.items (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references public.vendors(id) on delete set null,
  title text not null,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  department text not null check (department in ('men', 'women', 'unisex')),
  size text,
  measurements jsonb not null default '{}'::jsonb,
  condition_grade text not null check (condition_grade in ('A', 'B', 'C')),
  base_price_ghs numeric(10, 2) not null check (base_price_ghs >= 0),
  sale_price_ghs numeric(10, 2) check (sale_price_ghs >= 0),
  sale_starts_at timestamptz,
  sale_ends_at timestamptz,
  status text not null default 'available'
    check (status in ('available', 'reserved', 'sold', 'hidden', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored
);

create index items_status_idx on public.items(status);
create index items_category_id_idx on public.items(category_id);
create index items_department_idx on public.items(department);
create index items_search_vector_idx on public.items using gin(search_vector);

-- item_images ---------------------------------------------------------------
create table public.item_images (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  storage_path text not null,
  position integer not null default 0
);

create index item_images_item_id_idx on public.item_images(item_id);

-- order_batches ---------------------------------------------------------
create table public.order_batches (
  id uuid primary key default gen_random_uuid(),
  closes_at timestamptz not null,
  delivery_date date,
  pickup_point text,
  status text not null default 'open' check (status in ('open', 'closed', 'completed')),
  created_at timestamptz not null default now()
);
