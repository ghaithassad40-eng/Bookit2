# Bookit

A production-grade **multi-tenant booking SaaS** built with React + TypeScript + Vite + TailwindCSS + Framer Motion + Supabase.

Every business gets its own branded customer site, services, staff, slots and JSON-driven configuration. Nothing is hard-coded — all branding, copy, theme and booking rules come from Supabase tables and JSON columns.

---

## Stack

- **Frontend** — React 18, TypeScript, Vite, React Router v6, Zustand, TanStack Query
- **UI** — TailwindCSS, shadcn-style primitives (Radix UI), Framer Motion, Lucide icons, Sonner toasts
- **Backend** — Supabase (Postgres, Auth, Realtime, Storage, Edge Functions, Row Level Security)
- **Editor** — Monaco for live JSON config editing

## Routes

### Customer (per-tenant by slug)
- `/business/:slug` — landing page (hero, services, staff, testimonials)
- `/business/:slug/book` — booking flow: service → staff → slot → details → review
- `/business/:slug/confirmation?ref=...` — confirmation screen

### Admin (auth-gated)
- `/admin/login` — sign in / create account
- `/admin/:slug` — overview dashboard with charts and KPIs
- `/admin/:slug/bookings` — searchable, filterable booking list with status updates
- `/admin/:slug/services` — services CRUD with active/inactive toggle
- `/admin/:slug/staff` — staff CRUD
- `/admin/:slug/slots` — slot management with calendar grouping
- `/admin/:slug/settings` — JSON config editor (theme, copy, rules, layout)

### Public
- `/` — discovery page listing demo workspaces

## Project structure

```
Bookit/
├─ supabase/
│  ├─ migrations/
│  │  ├─ 0001_init_schema.sql      ← tables, indexes, triggers, atomic booking RPC
│  │  ├─ 0002_rls_policies.sql     ← Row Level Security per tenant
│  │  └─ 0003_seed_data.sql        ← demo businesses + services + staff + slots
│  └─ functions/
│     └─ create-booking/index.ts   ← optional Edge Function
├─ src/
│  ├─ lib/
│  │  ├─ supabase.ts               ← typed Supabase client
│  │  ├─ database.types.ts         ← table & JSON-column types
│  │  ├─ defaults.ts               ← fallback configs
│  │  └─ utils.ts                  ← cn(), formatters, hexToHsl()
│  ├─ hooks/
│  │  ├─ useBusiness.ts            ← business + config bundle
│  │  ├─ useServices.ts
│  │  ├─ useStaff.ts
│  │  ├─ useSlots.ts               ← realtime-subscribed slot list
│  │  ├─ useBookings.ts            ← list / create / update status
│  │  ├─ useAuth.ts
│  │  └─ useAdminBusinesses.ts
│  ├─ store/bookingStore.ts        ← Zustand booking flow
│  ├─ components/
│  │  ├─ ui/                       ← Button, Card, Input, Dialog, Tabs, Badge, Skeleton, Empty
│  │  ├─ layout/                   ← CustomerLayout, AdminLayout
│  │  ├─ customer/                 ← Hero, ServiceCard, StaffCard, SlotPicker, BookingForm, BookingStepper
│  │  ├─ admin/JsonConfigEditor.tsx
│  │  └─ ThemeProvider.tsx         ← applies theme_json → CSS variables
│  ├─ pages/
│  │  ├─ Home.tsx
│  │  ├─ NotFound.tsx
│  │  ├─ customer/                 ← Landing, Book, Confirmation
│  │  └─ admin/                    ← Login, Dashboard, Bookings, Services, Staff, Slots, Settings
│  ├─ router.tsx
│  ├─ App.tsx
│  ├─ main.tsx
│  └─ index.css
├─ index.html
├─ package.json
├─ tailwind.config.ts
├─ tsconfig.json
└─ vite.config.ts
```

## Setup

### 1. Install

```bash
npm install
```

### 2. Configure Supabase

Create a Supabase project, then copy the env template:

```bash
cp .env.example .env.local
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### 3. Run migrations

In the Supabase SQL editor (or via CLI), run in order:

1. `supabase/migrations/0001_init_schema.sql`
2. `supabase/migrations/0002_rls_policies.sql`
3. `supabase/migrations/0003_seed_data.sql` *(optional demo data)*

> Demo seed creates four public businesses with no `owner_id`. To manage one as an admin, create a user via `/admin/login`, then in SQL set:
> ```sql
> update public.businesses set owner_id = '<your-user-id>' where slug = 'pulse-athletic';
> ```

### 4. (Optional) Deploy the edge function

```bash
supabase functions deploy create-booking
```

Set `VITE_USE_EDGE_BOOKING=true` to route bookings through the function instead of the SQL RPC. Both paths use the same `create_booking_atomic()` Postgres function for race-safe slot reservation.

### 5. Run the dev server

```bash
npm run dev
```

Open http://localhost:5173 — the home page lists all active demo workspaces.

## How configuration works

Every business has a `business_configs` row with four JSONB columns:

| Column | Purpose |
| --- | --- |
| `theme_json` | colors, font, mode, border radius, card style — applied as CSS variables by `ThemeProvider` |
| `copy_json` | hero title/subtitle, CTA text, confirmation message |
| `booking_rules_json` | which fields are required, slot duration, advance window, cancellation window |
| `layout_json` | toggle landing-page sections (testimonials, staff, services preview) |

Edit them live in the admin **Settings** screen (Monaco JSON editor with validation). Changes propagate instantly because the customer site reads the same config rows through React Query.

## Booking engine

`create_booking_atomic()` (in `0001_init_schema.sql`) is a `SECURITY DEFINER` RPC that:

1. Locks the `time_slots` row with `FOR UPDATE`
2. Verifies the slot is `open`, not in the past, and has remaining capacity
3. Inserts the booking with a generated `BK-XXXXXXXX` reference
4. Increments `booked_count`, flips status to `full` if at capacity
5. Returns the new booking row

This makes double-booking impossible even with concurrent requests. The Edge Function is a thin wrapper around the same RPC for environments that need it.

## Row Level Security

All six tables have RLS enabled (`0002_rls_policies.sql`):

- **Public** can read active businesses, services, staff, configs, and all slots.
- **Public** can create bookings (insert only).
- **Owners** (`businesses.owner_id = auth.uid()`) can read/write everything for their business.
- Cross-tenant access is blocked by policy.

## Payments — MyFatoorah (KNET / Visa / Apple Pay / Google Pay / etc.)

Bookit ships an end-to-end MyFatoorah integration covering the full life-cycle:
**InitiatePayment → ExecutePayment → redirect → GetPaymentStatus → reconcile**.

| File | Purpose |
| --- | --- |
| `supabase/functions/myfatoorah-initiate/index.ts` | Calls `InitiatePayment` to discover available methods + per-method service charge, resolves the customer's selected method to a `PaymentMethodId`, then calls `ExecutePayment` and returns the hosted `PaymentURL`. |
| `supabase/functions/myfatoorah-callback/index.ts` | Verifies the payment via `GetPaymentStatus` after the customer is redirected back, updates the `bookings` row's `payment_status`, writes a `payment_events` audit row. |
| `src/lib/myfatoorah.ts` | Frontend client. Posts to the edge function, stores the pending booking in `localStorage` before redirect, and reconciles on return. |
| `src/pages/customer/PaymentCallback.tsx` | Reached at `/business/:slug/payment/callback?paymentId=…`. Verifies the payment, finalises the booking through `create_booking_atomic`, then forwards to the confirmation page. |
| `src/pages/customer/MyFatoorahMock.tsx` | Drop-in replica of MyFatoorah's hosted page used in **demo mode** so the redirect flow works without real credentials. Real MyFatoorah replaces this URL once enabled. |
| `supabase/migrations/0005_myfatoorah.sql` | Adds `provider`, `provider_invoice_id`, `provider_payment_url`, `provider_initiated_at` to `bookings` and opens `payment_events` inserts to the service role. |

### Supported methods (resolved server-side)

Visa / Mastercard, KNET, Apple Pay, Google Pay, Samsung Pay, Mada, AMEX, STC Pay
— mapped to MyFatoorah's `PaymentMethodCode` in `myfatoorah-initiate/index.ts`.

### Staging quick-start

```bash
# 1. Deploy the two edge functions
supabase functions deploy myfatoorah-initiate
supabase functions deploy myfatoorah-callback

# 2. Set staging credentials. The token below is MyFatoorah's PUBLIC test
#    token from their docs — works only against apitest.myfatoorah.com.
supabase secrets set MYFATOORAH_BASE_URL=https://apitest.myfatoorah.com
supabase secrets set MYFATOORAH_API_KEY="rLtt6JWvbUHDDhsZnfpAhpYk4dxYDQkbcPTyGaKp2TYqQgG7FGZ5Th_WD53Oq8Ebz6A53njUoo1w3pjU1D4vs_ZMqFiz_j0urb_BH9Oq9VZoKFoJEDAbRZepGcQanImyYrry7Kt6MnMdgfG5jn4HngWoRdKduNNyP4kzcgtwsV_uwHFIFbJ4"
supabase secrets set MYFATOORAH_RETURN_BASE=https://your-deployed-site.com

# 3. Apply the SQL migrations
supabase db push   # or run 0001 → 0005 in the SQL editor

# 4. Enable on the frontend
echo 'VITE_MYFATOORAH_ENABLED=true' >> .env.local
```

### Test cards (MyFatoorah staging)

| Method | Number | Expiry | CVC | OTP |
|---|---|---|---|---|
| KNET | `0000000001` | — | — | `1234` |
| Visa | `4005550000000001` | any future | `123` | `1234` |
| Mastercard | `5123450000000008` | any future | `123` | `1234` |
| AMEX | `346391000000019` | any future | `1234` | `1234` |

### Going live

1. Switch `MYFATOORAH_BASE_URL` to your regional production endpoint
   (`https://api.myfatoorah.com` for Kuwait, `…-sa` for Saudi, etc.).
2. Replace `MYFATOORAH_API_KEY` with the live token from your MyFatoorah portal.
3. In your portal, add `https://your-site.com/business/*/payment/callback` to
   the allowed callback URLs.
4. Set `MYFATOORAH_RETURN_BASE` to your public origin.

The frontend code does not change — `VITE_MYFATOORAH_ENABLED=true` is enough.

### Demo mode (no setup)

When `VITE_MYFATOORAH_ENABLED=false` (or Supabase isn't connected) the
booking flow redirects to `/payment/myfatoorah-mock` — a fully-rendered
look-alike of MyFatoorah's hosted page so you can demonstrate the entire
redirect → callback → confirmation journey without any credentials.

## Build

```bash
npm run build
npm run preview
```

## License

MIT
