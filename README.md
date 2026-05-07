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

## Build

```bash
npm run build
npm run preview
```

## License

MIT
