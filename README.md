# Ntaade

Mobile-first web app where Ashesi students browse and order affordable
second-hand clothing sourced from local market vendors. Students never see or
contact vendors: the admin (you) is the middleman. You list the stock, students
order, you collect payment by mobile money and hand the clothes over at pickup.

**Stack:** React + Vite + TypeScript, Tailwind CSS, React Router (hash routing) ·
Supabase (Postgres, Auth, Storage, Row Level Security) · Netlify. Everything runs
on free tiers.

**Status:** all four phases are built.

1. Database, security, categories, promotions, settings, checkout function
2. Branding, layout, public browsing (filters, search, product pages)
3. Guest cart, email + password sign-in, checkout, student orders
4. Admin area: orders, items, categories, promotions, settings, batches, pickup list

---

## Setup (do these once, in order)

### 1. Create the Supabase project
Create a free project at [supabase.com](https://supabase.com). From
**Project Settings → API** you need the *Project URL* and the *anon public* key.
Never put the `service_role` key anywhere in this app.

### 2. Run the migrations
In **SQL Editor**, open each file in `supabase/migrations/` **in order** and run it.
They are written to be safe to re-run, except the seed.

| File | What it does |
| --- | --- |
| `0001_auth_restriction.sql` | Only `@ashesi.edu.gh` emails can sign up (enforced in the database). |
| `0002`–`0004` | Tables: profiles, vendors, categories, items, images, batches, orders, cart, promotions, settings. |
| `0005_public_items_view.sql` | The `items_public` view students browse through (never exposes the vendor). |
| `0006_rls_policies.sql` | Row Level Security on every table. |
| `0007_functions.sql` | Server-side pricing and the atomic `checkout()`. |
| `0008_seed.sql` | Sample categories, items, a batch and a promotion. **Skip this if you want a clean shop**, or delete the sample items later. Running it twice duplicates the items. |
| `0009_grants.sql` | Explicit anon/authenticated grants. |
| `0010_phase3_cart_payments_security.sql` | **Security fix** (stops a student promoting themselves to admin), cart pricing, promo codes, payment reference and cancel functions. |
| `0011_phase4_admin.sql` | Admin functions (order status changes, category delete, bulk discount, promotion preview) and the **`item-images` storage bucket with admin-only upload rules**. |

> If you ran 0001–0009 earlier, you must still run **0010 and 0011**. Until 0010
> is run, any signed-in student could give themselves admin rights.

`pg_cron` is optional. If your project has it, 0007 schedules a job that frees
expired 24-hour holds; without it, holds are freed the next time anyone checks out or submits
a payment reference. Either way the result is correct.

### 3. Sign-in settings (email + password, no email verification)
Students create an account with their `@ashesi.edu.gh` address and a password. No email is sent.

1. **Authentication → Providers → Email**: keep Email enabled and turn **Confirm email OFF**.
   (If it stays on, sign-up fails with a message telling you exactly this.)
2. Only `@ashesi.edu.gh` addresses can register; the database itself rejects anything else (migration 0001).

Trade-offs of skipping verification: the app can't prove someone owns the address they type,
and there is no "forgot password" email. To reset a password, open **Authentication → Users**,
pick the student, and set a new one. Because anyone could register an address before its owner
does, **create your own admin account first** (step 5). If you later want proof of ownership,
turn "Confirm email" back on and add custom SMTP.

### 4. Environment variables
Copy `.env.example` to `.env` and fill in:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

The anon key is designed to be public (it ships inside the site); Row Level
Security is what protects the data.

### 5. Create your first admin
1. Open the app, choose **Create an account** and register with your `@ashesi.edu.gh` email and a password.
2. In the SQL Editor run:
   ```sql
   update public.profiles set role = 'admin' where id =
     (select id from auth.users where email = 'you@ashesi.edu.gh');
   ```
3. Reload the app. An **Admin** link appears in your account menu.

Roles can only be changed this way, from the SQL editor. The app itself cannot
promote anyone.

### 6. Set your payment details
Sign in → **Admin → Settings** and enter your MoMo network, number, account name and
the delivery fee. Students see these at checkout. (Until you do, they see a placeholder.)

---

## Testing and deploying

The app builds to **one self-contained file**, `dist/index.html` (CSS and JS
inlined), and uses hash URLs (`index.html#/cart`). That means:

- **Test locally** by double-clicking `dist/index.html`. It talks straight to your
  Supabase project.
- **Deploy** by dragging `index.html` (or the zip) onto your site's *Deploys* page on Netlify.
  There is no build step on Netlify, so no build minutes are used.

```bash
npm install
npm run build      # produces dist/index.html
npm run lint
npm run dev        # optional: live-reload dev server
```

The `.env` values are baked in at build time, so rebuild after changing them.

**Do not connect this repo to Netlify's Git deploys.** Every push would trigger a build and
spend build minutes. Deploy only by uploading the built file (drag-and-drop, or the zip).
If a Netlify site is already linked to the repo, turn it off under
*Site configuration → Build & deploy → Continuous deployment → Stop builds*.

---

## Using the admin area (`/#/admin`)

- **Overview**: what needs attention (payments to confirm, paid orders to deliver).
- **Orders**: tabs for *To confirm*, *Awaiting payment*, *Paid*, *Delivered*,
  *Cancelled / refunded*. For a payment, compare the student's MoMo reference with
  your MoMo statement, then **Confirm payment** (items become sold) or **Reject
  reference** (they can resubmit). Also: mark delivered, cancel (items go back on
  sale), refund, and restore an expired order if the items are still free.
- **Items**: one table. Edit price, sale price, status and category inline. Tick rows
  for bulk actions: percentage discount (0% removes it), mark unavailable, hide,
  change category. Items already in an order are never touched by bulk actions.
  **+ Add item** takes multiple photos, shrinks each under 300 KB in your browser
  before upload, and lets you order them (first = cover). Type a new vendor code to
  create a vendor; vendors are never visible to students.
- **Batches**: create a pickup run (closing time, date, place), close or reopen it.
  **Pickup list** is a printable sheet of paid orders with a per-vendor sourcing list.
- **Categories**: add, rename, reorder, hide, delete. Deleting a category that has
  items makes you choose where they move.
- **Promotions**: percent or fixed amount, for everything, a category or chosen
  items, optional code, optional schedule, pause / end now. **Preview** shows exactly
  which items change price before you save.
- **Settings**: delivery fee and payment instructions.

## How the money side works

No payment gateway yet. At checkout the order reserves the items for 24 hours. The
student sends mobile money, types the transaction reference on their order page, and
you confirm it in Admin → Orders. An order with a submitted reference is never
auto-expired, so nobody loses a piece they already paid for. Each reference can only
be used once. `PaymentInstructions.tsx` and the `submit_payment_reference` /
`admin_set_order_status` functions are the seam to replace with Paystack or Hubtel later.

## Decisions worth knowing

- **Best deal wins, no stacking.** An item's own sale price, an automatic promotion and
  an entered code are compared and the lowest price is used. To change that, edit
  `compute_item_price()` in `0007_functions.sql`.
- **Prices are computed on the server** and stored on each order line; the browser never
  sends a price.
- **Refund after delivery keeps the item marked sold** (it has left; relist it by hand if
  it comes back). Refunding or cancelling before delivery puts the item back on sale.
- **Vendors and raw items are admin-only** at the database level. Students read only the
  `items_public` view.
- **Seed photos are placeholder URLs**; real photos go in the `item-images` bucket via the
  item editor.
- **Guest cart** lives in the browser and is merged into your account cart when you sign in.
  Nothing is reserved until checkout.

## Project layout

```
supabase/migrations/    Every schema change, run in order in the SQL editor.
src/lib/                Supabase client, formatting, image compression, helpers.
src/theme/              Tailwind brand tokens (brand red, white, neutral grays).
src/components/         Shared UI (layout, filters, product cards, toasts).
src/features/           auth, cart, catalog, checkout, orders, product, admin/*
src/types/database.ts   Hand-written Supabase types (regenerate with the Supabase CLI if you like).
```
