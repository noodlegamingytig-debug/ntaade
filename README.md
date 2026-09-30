# Ntaade

Mobile-first web app for Ashesi University students to browse and order
affordable second-hand clothing sourced from local market vendors. Students
never see or contact vendors directly — the admin (you) is the middleman.

**Stack:** React + Vite + TypeScript, Tailwind CSS, React Router · Supabase
(Postgres, Auth, Storage, RLS) · Netlify hosting. Everything runs on the
Supabase and Netlify free tiers.

**Status:** Phase 1 (database & security) complete. See the phase plan
below.

## Phase plan

1. **Database, security, categories, promotions, settings, checkout function** — done.
2. Branding, layout, and the public browsing experience (filters, search).
3. Cart, sign-in, checkout, and student order pages.
4. Admin area: items, categories, promotions, settings, orders, batches.

Each phase stops for review before moving to the next.

## Phase 1 setup

Follow these steps to get the database running before Phase 2 lands.

### 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project (free tier).
2. Pick a database password and save it somewhere safe — you won't need it for this app (we only use the anon key), but you'll want it if you ever connect a Postgres client directly.
3. Wait for provisioning to finish, then open the project.

### 2. Run the migrations

The SQL editor is the easiest path (no CLI required):

1. In the Supabase dashboard, go to **SQL Editor**.
2. Open each file in `supabase/migrations/`, **in order** (0001 through 0009), paste its contents into a new query, and run it.
   - `0001_auth_restriction.sql` — restricts signups to `@ashesi.edu.gh` emails at the database level.
   - `0002_core_tables.sql` — profiles, vendors, categories, items, item_images, order_batches.
   - `0003_orders_cart.sql` — orders, order_items, cart_items.
   - `0004_promotions_settings.sql` — promotions, settings.
   - `0005_public_items_view.sql` — the `items_public` view students browse through (never exposes `vendor_id`).
   - `0006_rls_policies.sql` — Row Level Security on every table.
   - `0007_functions.sql` — pricing (`get_effective_prices`), `checkout()`, and hold-expiry logic.
   - `0008_seed.sql` — ~15 sample items, categories, a vendor, an open pickup batch, and a sample promotion, so you can test the UI without real stock.
   - `0009_grants.sql` — explicit `anon`/`authenticated` grants (belt-and-suspenders alongside Supabase's default privileges).
3. Each file should run with no errors. If one fails partway through, fix the reported issue and re-run just that file — they're written to be safe to re-run (`create or replace`, `if not exists`, `on conflict do nothing`), with the exception of the seed data, which will insert duplicate sample items if run twice. If you need to re-seed, delete the existing seed rows first or just skip re-running `0008`.

**About `pg_cron`:** `0007_functions.sql` tries to schedule a job that
releases expired 24-hour holds every 15 minutes. `pg_cron` isn't on every
Supabase free-tier project — the migration checks for it and skips
gracefully (with a notice) if it's unavailable. Either way, holds are also
released lazily at the start of every `checkout()` call, so expiry is
always correct even without the cron job; the cron job just means stale
reservations free up promptly instead of only when someone next checks out.

### 3. Set up Storage

Item photos are stored in Supabase Storage, not the database.

1. Go to **Storage** in the dashboard and create a bucket named `item-images`.
2. Make it a **public** bucket (product photos are meant to be publicly viewable — this is standard for a storefront and doesn't expose anything sensitive).
3. Add a storage policy so only admins can upload/delete, since students never manage listings. In **Storage → Policies** for `item-images`, add:
   - **SELECT**: allow `public` (anyone can view images) — or leave it open since the bucket itself is public.
   - **INSERT/UPDATE/DELETE**: restrict to authenticated users where `public.is_admin()` (the same helper function migration `0006` created) returns true. Example policy expression: `public.is_admin()`.

Seed data (`0008_seed.sql`) uses placeholder image URLs (picsum.photos)
rather than real Storage paths, so the catalog has something to render
before you upload real photos. The image component built in Phase 2 will
render a `storage_path` directly when it starts with `http`, and resolve
it against this bucket's public URL otherwise — so once you upload real
photos and use their Storage paths, everything switches over automatically.

### 4. Create your first admin user

1. Sign up through the app once it's deployed (or via **Authentication → Users → Add user** in the dashboard) with an `@ashesi.edu.gh` email. This auto-creates a matching row in `profiles` with `role = 'student'`.
2. In the **SQL Editor**, promote yourself:
   ```sql
   update public.profiles set role = 'admin' where id =
     (select id from auth.users where email = 'you@ashesi.edu.gh');
   ```
3. You now have admin access (once the Phase 4 admin UI exists — for now this just sets the flag RLS checks).

### 5. Configure environment variables

1. Copy `.env.example` to `.env`.
2. In the Supabase dashboard, go to **Project Settings → API** and copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
3. **Never** copy the `service_role` key into this file or anywhere in the frontend — it bypasses RLS entirely.

### 6. Run locally

```bash
npm install
npm run dev
```

You should see a "Connected — N available items in the catalog" message,
confirming the anon key can read `items_public` and RLS is set up
correctly.

### 7. Deploy to Netlify

1. Push this repo to GitHub (or your git host of choice).
2. In Netlify, **Add new site → Import an existing project**, pick the repo.
3. Build settings are already in `netlify.toml` (`npm run build`, publish `dist`), so you shouldn't need to change anything.
4. In **Site configuration → Environment variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the same values as your `.env`.
5. Deploy. The SPA redirect in `netlify.toml` means client-side routing (added in Phase 2) will work correctly on refresh/direct links.

## Project structure

```
supabase/migrations/   All schema changes — run in order in the SQL editor.
src/lib/                Supabase client and other shared utilities.
src/theme/              Tailwind brand tokens (red/white, per the addendum).
src/components/         Shared, mostly presentational UI pieces.
src/features/           One folder per app area (catalog, cart, checkout,
                         orders, auth, admin/*) — built out phase by phase.
src/types/database.ts   Hand-authored Supabase types; regenerate via the
                         Supabase CLI once you have a live project.
```

## Notes on decisions made in Phase 1

- **"Best deal wins," not stacking.** An item's own sale price, an automatic promotion, and an entered promo code are compared and the lowest price is used — they don't combine. If you'd rather they stack, that's a straightforward change to `compute_item_price()` in `0007_functions.sql` — flag it and we'll revisit.
- **Seed images are external placeholder URLs**, not real Storage paths (see the Storage section above) — purely so the catalog isn't empty before you've uploaded real photos.
- **`vendors` and `items` are admin-only tables at the RLS level.** Students only ever read through `items_public`, which is owned by the migration role and so reads through Postgres's normal view-ownership behavior rather than being blocked by the items table's own RLS — this is what lets it deliberately show a filtered, vendor-free subset of a table students otherwise can't touch at all.
