-- ============================================================
-- Bookit — Production schema catch-up
-- ============================================================
--
-- The React app ships features (i18n columns, equipment add-ons, reviews,
-- saved payment methods, approval state, VAT registration, audit log)
-- that didn't have backing tables / columns in earlier migrations because
-- the demo flow runs entirely from localStorage. This migration brings
-- the database up to parity with the production code paths so the
-- isSupabaseConfigured branches stop falling back.
--
-- Designed to be idempotent: every `add column`, `create table`, and
-- `create index` is guarded with `if not exists`. Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. businesses — i18n + approval state + VAT registration
-- ---------------------------------------------------------------------------

alter table public.businesses
  add column if not exists name_ar text,
  add column if not exists status text not null default 'approved'
    check (status in ('pending', 'approved', 'suspended', 'rejected')),
  add column if not exists rejection_reason text,
  add column if not exists vat_registered boolean;

comment on column public.businesses.name_ar is
  'Optional Arabic translation of name. UI falls back to name when null.';
comment on column public.businesses.status is
  'Marketplace approval state. New vendor signups start as pending; the platform admin moves them to approved/rejected/suspended. Customer-facing surfaces only show approved.';
comment on column public.businesses.vat_registered is
  'true = invoices show the country VAT line; false = vendor explicitly under threshold/exempt; null = use country default (see src/lib/tax.ts).';

create index if not exists businesses_status_idx on public.businesses(status);

-- ---------------------------------------------------------------------------
-- 2. business_configs — Arabic copy override
-- ---------------------------------------------------------------------------

alter table public.business_configs
  add column if not exists copy_json_ar jsonb;

comment on column public.business_configs.copy_json_ar is
  'Optional Arabic translation of copy_json. Per-field fallback to copy_json when a key is missing.';

-- ---------------------------------------------------------------------------
-- 3. services + staff — i18n columns
-- ---------------------------------------------------------------------------

alter table public.services
  add column if not exists name_ar text,
  add column if not exists description_ar text;

alter table public.staff
  add column if not exists name_ar text,
  add column if not exists role_ar text,
  add column if not exists specialty_ar text,
  add column if not exists bio_ar text;

-- ---------------------------------------------------------------------------
-- 4. equipment — per-business add-ons (printer, monitor, racket, etc.)
-- ---------------------------------------------------------------------------

create table if not exists public.equipment (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses(id) on delete cascade,
  name             text not null,
  name_ar          text,
  description      text,
  description_ar   text,
  category         text not null default 'other',
  -- price = null means "included free with any booking".
  price            numeric(10,2) check (price is null or price >= 0),
  currency         text not null default 'USD',
  image_url        text,
  -- Lowercase keyword tags used by the AI equipment search.
  features         text[] not null default '{}',
  max_per_booking  integer not null default 1 check (max_per_booking >= 1),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists equipment_business_idx on public.equipment(business_id);
create index if not exists equipment_active_idx   on public.equipment(business_id, is_active);
-- GIN index lets the AI search match features via the `?` operator
-- (e.g. WHERE features @> ARRAY['4k']) without a full table scan.
create index if not exists equipment_features_idx on public.equipment using gin(features);

-- ---------------------------------------------------------------------------
-- 5. booking_equipment — line items recorded against each booking
-- ---------------------------------------------------------------------------

create table if not exists public.booking_equipment (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references public.bookings(id) on delete cascade,
  equipment_id  uuid not null references public.equipment(id) on delete restrict,
  quantity      integer not null check (quantity >= 1),
  -- unit_price snapshotted from equipment.price at booking time so vendor
  -- price changes don't retroactively edit issued receipts. Zero for items
  -- whose source row's price was null.
  unit_price    numeric(10,2) not null check (unit_price >= 0),
  currency      text not null,
  created_at    timestamptz not null default now()
);

create index if not exists booking_equipment_booking_idx   on public.booking_equipment(booking_id);
create index if not exists booking_equipment_equipment_idx on public.booking_equipment(equipment_id);

-- ---------------------------------------------------------------------------
-- 6. reviews — customer-written feedback after a booking completes
-- ---------------------------------------------------------------------------

create table if not exists public.reviews (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  -- Optional FK — a review is normally tied to a specific booking, but
  -- existing prod data may have orphaned reviews from before this column
  -- was enforced. Nullable for back-compat; the customer flow always sets it.
  booking_id      uuid references public.bookings(id) on delete set null,
  rating          integer not null check (rating between 1 and 5),
  comment         text,
  comment_ar      text,
  customer_name   text not null,
  customer_email  text,
  is_public       boolean not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists reviews_business_idx on public.reviews(business_id);
create index if not exists reviews_booking_idx  on public.reviews(booking_id);

-- ---------------------------------------------------------------------------
-- 7. customer_payment_methods — tokenized saved cards per customer
-- ---------------------------------------------------------------------------
--
-- IMPORTANT: this table NEVER stores raw card data. Only:
--   - a PSP-issued token (MyFatoorah / Stripe equivalent)
--   - display metadata (brand, last 4, expiry, cardholder name)
-- The customer enters card details on the PSP's hosted page; the PSP
-- returns the token; we store the token. PCI scope stays with the PSP.

create table if not exists public.customer_payment_methods (
  id                 uuid primary key default gen_random_uuid(),
  customer_user_id   uuid not null references auth.users(id) on delete cascade,
  brand              text not null check (brand in (
    'visa', 'mastercard', 'amex', 'knet', 'mada', 'apple_pay', 'google_pay', 'other'
  )),
  last4              text not null check (length(last4) = 4 and last4 ~ '^[0-9]+$'),
  exp_month          integer not null check (exp_month between 1 and 12),
  exp_year           integer not null check (exp_year >= 2024),
  cardholder_name    text not null,
  is_default         boolean not null default false,
  auto_pay           boolean not null default false,
  -- Opaque PSP token. NEVER the full card number.
  psp_token          text not null,
  -- Which PSP issued the token, so we route subsequent charges back
  -- through the same one.
  psp_provider       text not null default 'myfatoorah',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists customer_payment_methods_user_idx
  on public.customer_payment_methods(customer_user_id);

-- At most one default card per customer.
create unique index if not exists customer_payment_methods_one_default_idx
  on public.customer_payment_methods(customer_user_id)
  where is_default = true;

-- ---------------------------------------------------------------------------
-- 8. audit_log — append-only history of sensitive state changes
-- ---------------------------------------------------------------------------
--
-- Triggers below (in migration 0011) populate this for:
--   - businesses.status transitions (approve / suspend / reject)
--   - bookings.status transitions (cancel / refund)
--   - payouts inserts (vendor payouts)
-- Append-only: there's no update / delete policy. Even platform admins
-- can only read.

create table if not exists public.audit_log (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references auth.users(id) on delete set null,
  -- 'business.status_changed', 'booking.cancelled', 'payout.released', etc.
  event_type   text not null,
  entity_type  text not null,
  entity_id    uuid not null,
  before_state jsonb,
  after_state  jsonb,
  metadata     jsonb,
  ip_address   inet,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index if not exists audit_log_entity_idx on public.audit_log(entity_type, entity_id);
create index if not exists audit_log_actor_idx  on public.audit_log(actor_id);
create index if not exists audit_log_created_idx on public.audit_log(created_at desc);

-- ---------------------------------------------------------------------------
-- 9. user_roles — server-controlled RBAC
-- ---------------------------------------------------------------------------
--
-- We avoid putting role on app_metadata because Supabase's anon key can
-- read user_metadata fields client-side, and we want role to be inspectable
-- only via the JWT (via our is_platform_admin() helper below). A separate
-- table keyed by user_id is the cleanest fit and supports future
-- multi-tenant role granting.

create table if not exists public.user_roles (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  role     text not null check (role in ('vendor', 'platform_admin')),
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null
);

-- Updated-at maintenance trigger reused from earlier migrations.
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'set_updated_at') then
    create function public.set_updated_at() returns trigger
      language plpgsql as $f$
      begin
        new.updated_at = now();
        return new;
      end;
      $f$;
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'equipment_set_updated_at'
  ) then
    create trigger equipment_set_updated_at
      before update on public.equipment
      for each row execute function public.set_updated_at();
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'customer_payment_methods_set_updated_at'
  ) then
    create trigger customer_payment_methods_set_updated_at
      before update on public.customer_payment_methods
      for each row execute function public.set_updated_at();
  end if;
end$$;
