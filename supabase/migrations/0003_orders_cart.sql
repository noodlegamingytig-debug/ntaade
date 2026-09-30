-- orders, order_items, cart_items.
-- One order per checkout (can contain several items); cart_items tracks
-- what a signed-in student has added but not yet checked out.

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  batch_id uuid not null references public.order_batches(id),
  subtotal_ghs numeric(10, 2) not null,
  discount_total_ghs numeric(10, 2) not null default 0,
  delivery_fee_ghs numeric(10, 2) not null default 0,
  total_ghs numeric(10, 2) not null,
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment', 'paid', 'delivered', 'cancelled', 'refunded', 'expired')),
  payment_reference text,
  promo_code text,
  hold_expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now()
);

create index orders_student_id_idx on public.orders(student_id);
create index orders_batch_id_idx on public.orders(batch_id);
create index orders_status_idx on public.orders(status);
create index orders_hold_expires_at_idx on public.orders(hold_expires_at)
  where status = 'awaiting_payment';

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  item_id uuid not null references public.items(id),
  price_paid_ghs numeric(10, 2) not null,
  title_snapshot text not null
);

create index order_items_order_id_idx on public.order_items(order_id);
create index order_items_item_id_idx on public.order_items(item_id);

-- "An item can only belong to one active order at a time" is enforced by
-- the checkout() function (migration 0007), which locks each item row
-- with SELECT ... FOR UPDATE and re-checks items.status inside the same
-- transaction before reserving it. A partial unique index can't express
-- that constraint here (it would need to look at items.status, a
-- different table, which Postgres partial index predicates can't
-- reference), so the row-locking transaction is the actual guarantee —
-- not a database constraint on this table.

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  added_at timestamptz not null default now(),
  unique (student_id, item_id)
);

create index cart_items_student_id_idx on public.cart_items(student_id);
