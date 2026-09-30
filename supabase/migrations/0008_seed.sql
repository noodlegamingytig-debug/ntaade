-- Seed data: categories, a vendor, ~15 sample items, and an open batch,
-- so the UI can be exercised without real stock. No profiles/orders are
-- seeded — those only make sense for real auth users (see README for
-- creating your first admin).
--
-- Seed item images use full placeholder image URLs (picsum.photos) rather
-- than real Supabase Storage paths, purely so the catalog has something to
-- render before any real photos are uploaded. The frontend's image
-- component should render storage_path directly when it starts with
-- "http", and otherwise resolve it against Supabase Storage's public URL
-- — see the note in README's Phase 1 setup section.

insert into public.categories (name, slug, sort_order) values
  ('Tops', 'tops', 1),
  ('Bottoms', 'bottoms', 2),
  ('Dresses', 'dresses', 3),
  ('Outerwear', 'outerwear', 4),
  ('Shoes', 'shoes', 5),
  ('Accessories', 'accessories', 6),
  ('Bags', 'bags', 7)
on conflict (slug) do nothing;

insert into public.vendors (code_name, notes) values
  ('V-MAKOLA-01', 'Seed vendor for local dev/testing')
on conflict (code_name) do nothing;

insert into public.order_batches (closes_at, delivery_date, pickup_point, status) values
  (now() + interval '5 days', (now() + interval '7 days')::date, 'Ashesi Quad, near the cafeteria', 'open');

do $$
declare
  v_vendor_id uuid;
  v_tops uuid;
  v_bottoms uuid;
  v_dresses uuid;
  v_outerwear uuid;
  v_shoes uuid;
  v_accessories uuid;
  v_bags uuid;
  v_item_id uuid;
begin
  select id into v_vendor_id from public.vendors where code_name = 'V-MAKOLA-01';
  select id into v_tops from public.categories where slug = 'tops';
  select id into v_bottoms from public.categories where slug = 'bottoms';
  select id into v_dresses from public.categories where slug = 'dresses';
  select id into v_outerwear from public.categories where slug = 'outerwear';
  select id into v_shoes from public.categories where slug = 'shoes';
  select id into v_accessories from public.categories where slug = 'accessories';
  select id into v_bags from public.categories where slug = 'bags';

  -- 1
  insert into public.items (vendor_id, title, description, category_id, department, size, measurements, condition_grade, base_price_ghs)
  values (v_vendor_id, 'Classic White Oxford Shirt', 'Crisp cotton oxford, lightly worn.', v_tops, 'men', 'M', '{"chest_in": 40, "length_in": 28}', 'A', 45)
  returning id into v_item_id;
  insert into public.item_images (item_id, storage_path, position) values (v_item_id, 'https://picsum.photos/seed/ntaade1/600/800', 0);

  -- 2
  insert into public.items (vendor_id, title, description, category_id, department, size, measurements, condition_grade, base_price_ghs, sale_price_ghs, sale_starts_at, sale_ends_at)
  values (v_vendor_id, 'Vintage Denim Jacket', 'Faded wash, brass buttons, great condition.', v_outerwear, 'unisex', 'L', '{"chest_in": 42, "length_in": 26}', 'B', 120, 89, now() - interval '1 day', now() + interval '14 days')
  returning id into v_item_id;
  insert into public.item_images (item_id, storage_path, position) values (v_item_id, 'https://picsum.photos/seed/ntaade2/600/800', 0);

  -- 3
  insert into public.items (vendor_id, title, description, category_id, department, size, measurements, condition_grade, base_price_ghs)
  values (v_vendor_id, 'High-Waist Mom Jeans', 'Straight leg, stretch denim.', v_bottoms, 'women', '28', '{"waist_in": 28, "inseam_in": 30}', 'A', 65)
  returning id into v_item_id;
  insert into public.item_images (item_id, storage_path, position) values (v_item_id, 'https://picsum.photos/seed/ntaade3/600/800', 0);

  -- 4
  insert into public.items (vendor_id, title, description, category_id, department, size, measurements, condition_grade, base_price_ghs)
  values (v_vendor_id, 'Floral Wrap Dress', 'Midi length, tie waist, breathable fabric.', v_dresses, 'women', 'S', '{"bust_in": 34, "length_in": 40}', 'A', 80)
  returning id into v_item_id;
  insert into public.item_images (item_id, storage_path, position) values (v_item_id, 'https://picsum.photos/seed/ntaade4/600/800', 0);

  -- 5
  insert into public.items (vendor_id, title, description, category_id, department, size, measurements, condition_grade, base_price_ghs)
  values (v_vendor_id, 'Black Leather Sneakers', 'Minimalist low-tops, real leather upper.', v_shoes, 'unisex', '42', '{"eu_size": 42}', 'B', 150)
  returning id into v_item_id;
  insert into public.item_images (item_id, storage_path, position) values (v_item_id, 'https://picsum.photos/seed/ntaade5/600/800', 0);

  -- 6
  insert into public.items (vendor_id, title, description, category_id, department, size, measurements, condition_grade, base_price_ghs, sale_price_ghs, sale_starts_at, sale_ends_at)
  values (v_vendor_id, 'Graphic Print Hoodie', 'Heavyweight fleece, front pocket.', v_tops, 'unisex', 'L', '{"chest_in": 44, "length_in": 27}', 'A', 95, 70, now() - interval '2 days', now() + interval '10 days')
  returning id into v_item_id;
  insert into public.item_images (item_id, storage_path, position) values (v_item_id, 'https://picsum.photos/seed/ntaade6/600/800', 0);

  -- 7
  insert into public.items (vendor_id, title, description, category_id, department, size, measurements, condition_grade, base_price_ghs)
  values (v_vendor_id, 'Pleated Midi Skirt', 'Satin finish, elastic waistband.', v_bottoms, 'women', 'M', '{"waist_in": 30, "length_in": 32}', 'A', 55)
  returning id into v_item_id;
  insert into public.item_images (item_id, storage_path, position) values (v_item_id, 'https://picsum.photos/seed/ntaade7/600/800', 0);

  -- 8
  insert into public.items (vendor_id, title, description, category_id, department, size, measurements, condition_grade, base_price_ghs)
  values (v_vendor_id, 'Canvas Tote Bag', 'Sturdy cotton canvas, inner pocket.', v_bags, 'unisex', 'One Size', '{}', 'A', 30)
  returning id into v_item_id;
  insert into public.item_images (item_id, storage_path, position) values (v_item_id, 'https://picsum.photos/seed/ntaade8/600/800', 0);

  -- 9
  insert into public.items (vendor_id, title, description, category_id, department, size, measurements, condition_grade, base_price_ghs)
  values (v_vendor_id, 'Slim Fit Chinos', 'Cotton twill, tapered leg.', v_bottoms, 'men', '32', '{"waist_in": 32, "inseam_in": 32}', 'B', 60)
  returning id into v_item_id;
  insert into public.item_images (item_id, storage_path, position) values (v_item_id, 'https://picsum.photos/seed/ntaade9/600/800', 0);

  -- 10
  insert into public.items (vendor_id, title, description, category_id, department, size, measurements, condition_grade, base_price_ghs)
  values (v_vendor_id, 'Wool Blend Overcoat', 'Knee length, tailored fit.', v_outerwear, 'men', 'L', '{"chest_in": 42, "length_in": 40}', 'B', 220)
  returning id into v_item_id;
  insert into public.item_images (item_id, storage_path, position) values (v_item_id, 'https://picsum.photos/seed/ntaade10/600/800', 0);

  -- 11
  insert into public.items (vendor_id, title, description, category_id, department, size, measurements, condition_grade, base_price_ghs)
  values (v_vendor_id, 'Silk Scarf', 'Hand-rolled edges, floral pattern.', v_accessories, 'women', 'One Size', '{}', 'A', 25)
  returning id into v_item_id;
  insert into public.item_images (item_id, storage_path, position) values (v_item_id, 'https://picsum.photos/seed/ntaade11/600/800', 0);

  -- 12
  insert into public.items (vendor_id, title, description, category_id, department, size, measurements, condition_grade, base_price_ghs)
  values (v_vendor_id, 'Running Shorts', 'Lightweight, built-in liner.', v_bottoms, 'men', 'M', '{"waist_in": 32}', 'C', 25)
  returning id into v_item_id;
  insert into public.item_images (item_id, storage_path, position) values (v_item_id, 'https://picsum.photos/seed/ntaade12/600/800', 0);

  -- 13
  insert into public.items (vendor_id, title, description, category_id, department, size, measurements, condition_grade, base_price_ghs, sale_price_ghs, sale_starts_at, sale_ends_at)
  values (v_vendor_id, 'Structured Crossbody Bag', 'Faux leather, adjustable strap.', v_bags, 'women', 'One Size', '{}', 'A', 90, 65, now() - interval '1 day', now() + interval '20 days')
  returning id into v_item_id;
  insert into public.item_images (item_id, storage_path, position) values (v_item_id, 'https://picsum.photos/seed/ntaade13/600/800', 0);

  -- 14
  insert into public.items (vendor_id, title, description, category_id, department, size, measurements, condition_grade, base_price_ghs)
  values (v_vendor_id, 'Canvas High-Top Sneakers', 'Classic style, lace-up.', v_shoes, 'unisex', '40', '{"eu_size": 40}', 'B', 70)
  returning id into v_item_id;
  insert into public.item_images (item_id, storage_path, position) values (v_item_id, 'https://picsum.photos/seed/ntaade14/600/800', 0);

  -- 15
  insert into public.items (vendor_id, title, description, category_id, department, size, measurements, condition_grade, base_price_ghs)
  values (v_vendor_id, 'Leather Belt', 'Genuine leather, brushed buckle.', v_accessories, 'men', 'M', '{"waist_in": 34}', 'A', 35)
  returning id into v_item_id;
  insert into public.item_images (item_id, storage_path, position) values (v_item_id, 'https://picsum.photos/seed/ntaade15/600/800', 0);
end $$;

-- A small automatic (no-code) promotion so the "biggest discount" sort
-- and sale-badge UI have something to show beyond individual item sales.
insert into public.promotions (name, type, value, scope, scope_category_id, code, is_active, starts_at, ends_at)
values (
  'Welcome Week 10% Off Accessories', 'percent', 10, 'category',
  (select id from public.categories where slug = 'accessories'),
  null, true, now() - interval '1 day', now() + interval '30 days'
);

