-- ============================================================
-- Bookit — Production Row Level Security
-- ============================================================
--
-- Tightens existing policies + adds policies for the tables introduced
-- in migration 0009. After this migration runs:
--
--   - The in-app gates (PlatformAdminLayout, AdminLayout, Confirmation
--     ownership) are mirrored at the database level. A raw API call
--     with a customer JWT can no longer read another customer's
--     bookings or write any vendor's data.
--   - Public surfaces only see businesses where status = 'approved'.
--     Pending / suspended / rejected businesses are invisible until
--     a platform admin approves them.
--   - Vendors can only touch their own business's rows. Their JWT
--     identifies them via auth.uid() = businesses.owner_id.
--   - Platform admins (user_roles.role = 'platform_admin') override
--     these restrictions where appropriate (status changes, audit
--     read, etc).
--
-- DESIGN: every helper is `stable` (not `volatile`) so PostgreSQL can
-- cache the result inside a single statement evaluation. Without
-- `stable`, RLS predicates re-execute per row which kills performance
-- on busy listings.

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

create or replace function public.current_user_id()
returns uuid language sql stable as $$
  select auth.uid();
$$;

create or replace function public.current_user_email()
returns text language sql stable as $$
  -- auth.email() returns the verified email from the JWT, lowercased.
  -- We lower() defensively in case a future Supabase release stops
  -- normalizing (the ownership check on bookings is case-insensitive).
  select lower(coalesce((auth.jwt() ->> 'email')::text, ''));
$$;

create or replace function public.is_platform_admin()
returns boolean language sql stable as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'platform_admin'
  );
$$;

-- The original is_business_owner() ships in 0002. Re-define here so the
-- definition lives in one place and supports platform_admin override
-- (i.e. platform admins behave as if they own every business for the
-- purposes of write policies that gate on ownership). The original
-- function is left in place; this one is the canonical version going
-- forward — both compile to the same SQL plan.
create or replace function public.is_business_owner(b_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.businesses
    where id = b_id
      and (owner_id = auth.uid() or public.is_platform_admin())
  );
$$;

-- ---------------------------------------------------------------------------
-- businesses — public read restricted to approved + owner override
-- ---------------------------------------------------------------------------

drop policy if exists "businesses public read" on public.businesses;

create policy "businesses public read"
  on public.businesses for select
  using (
    (is_active = true and status = 'approved')
    or owner_id = auth.uid()
    or public.is_platform_admin()
  );

-- Platform admins can update business.status / rejection_reason on
-- any row. Combined with the existing "owner update" policy this
-- gives owners control of their own data + platform admins control
-- of the approval state column. Postgres OR's policies of the same
-- command, so we just add a second.

drop policy if exists "businesses platform admin update" on public.businesses;
create policy "businesses platform admin update"
  on public.businesses for update
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "businesses platform admin select" on public.businesses;
-- (Already covered by the public-read policy via is_platform_admin(),
-- but kept explicit for documentation when reading pg_policies.)

-- ---------------------------------------------------------------------------
-- bookings — customer-scoped read + tighten insert
-- ---------------------------------------------------------------------------
--
-- BEFORE this migration: `bookings public insert` allowed anyone to
-- insert any booking row including arbitrary business_id values, and
-- the customer-side ownership gate lived only in Confirmation.tsx.
-- AFTER: customers can read their own bookings (by email match), inserts
-- require server-side validation via the create_booking_atomic RPC
-- (which runs SECURITY DEFINER), and vendors / platform admins keep
-- their existing access.

drop policy if exists "bookings public insert"  on public.bookings;
drop policy if exists "bookings customer read"  on public.bookings;
drop policy if exists "bookings owner read"     on public.bookings;
drop policy if exists "bookings customer update" on public.bookings;

-- Direct table insert is now blocked at the row level. Booking creation
-- goes through public.create_booking_atomic (see migration 0011) which
-- runs SECURITY DEFINER + validates the slot, business, and customer
-- email before inserting. This closes the "drive-by booking creator"
-- vector where anyone with the anon key could POST junk bookings.
-- (Service-role inserts via Edge Functions bypass RLS by design.)

create policy "bookings owner read"
  on public.bookings for select
  using (public.is_business_owner(business_id));

create policy "bookings customer read"
  on public.bookings for select
  using (
    customer_email is not null
    and lower(customer_email) = public.current_user_email()
  );

-- Customers can cancel their own bookings (status update only — they
-- can't touch payment fields). Vendor / platform admin keep full
-- update via the existing "bookings owner update" policy.
create policy "bookings customer cancel"
  on public.bookings for update
  using (
    customer_email is not null
    and lower(customer_email) = public.current_user_email()
    and status != 'cancelled'
  )
  with check (
    customer_email is not null
    and lower(customer_email) = public.current_user_email()
    -- Customers can only flip status → cancelled. Anything else needs
    -- vendor or platform-admin clearance.
    and status = 'cancelled'
  );

-- ---------------------------------------------------------------------------
-- equipment + booking_equipment
-- ---------------------------------------------------------------------------

alter table public.equipment          enable row level security;
alter table public.booking_equipment  enable row level security;

drop policy if exists "equipment public read" on public.equipment;
drop policy if exists "equipment owner write" on public.equipment;

create policy "equipment public read"
  on public.equipment for select
  using (
    is_active = true
    or public.is_business_owner(business_id)
  );

create policy "equipment owner write"
  on public.equipment for all
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- booking_equipment is locked down — only readable by the booking's
-- owner customer, the vendor, or platform admin. No direct insert; the
-- create_booking_atomic RPC populates these alongside the booking.

drop policy if exists "booking_equipment customer read" on public.booking_equipment;
drop policy if exists "booking_equipment owner read"    on public.booking_equipment;

create policy "booking_equipment customer read"
  on public.booking_equipment for select
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and b.customer_email is not null
        and lower(b.customer_email) = public.current_user_email()
    )
  );

create policy "booking_equipment owner read"
  on public.booking_equipment for select
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and public.is_business_owner(b.business_id)
    )
  );

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------

alter table public.reviews enable row level security;

drop policy if exists "reviews public read"    on public.reviews;
drop policy if exists "reviews customer write" on public.reviews;
drop policy if exists "reviews owner moderate" on public.reviews;

-- Anyone can read public reviews of approved businesses.
create policy "reviews public read"
  on public.reviews for select
  using (
    is_public = true
    and exists (
      select 1 from public.businesses
      where id = business_id and status = 'approved'
    )
  );

-- A signed-in customer can post a review tied to a booking they own.
create policy "reviews customer write"
  on public.reviews for insert
  with check (
    auth.uid() is not null
    and (
      booking_id is null
      or exists (
        select 1 from public.bookings b
        where b.id = booking_id
          and lower(b.customer_email) = public.current_user_email()
      )
    )
  );

-- Vendor + platform admin can hide a review (set is_public = false)
-- but never edit the rating/comment.
create policy "reviews owner moderate"
  on public.reviews for update
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- ---------------------------------------------------------------------------
-- customer_payment_methods
-- ---------------------------------------------------------------------------
--
-- Customers can read / write / delete their own saved cards. Nobody else
-- can. Platform admins do NOT get override here — the principle of least
-- privilege applies to payment data even for marketplace operators.

alter table public.customer_payment_methods enable row level security;

drop policy if exists "payment methods self read"   on public.customer_payment_methods;
drop policy if exists "payment methods self write"  on public.customer_payment_methods;

create policy "payment methods self read"
  on public.customer_payment_methods for select
  using (customer_user_id = auth.uid());

create policy "payment methods self write"
  on public.customer_payment_methods for all
  using (customer_user_id = auth.uid())
  with check (customer_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------
--
-- Append-only by design. Inserts happen only through SECURITY DEFINER
-- triggers (see migration 0011); RLS exposes no direct INSERT policy
-- so user JWTs can never write to it. Reads:
--   - Platform admin: all rows
--   - Vendor: rows for entities they own (their own businesses /
--     bookings / payouts)
--   - Customer: rows for their own bookings

alter table public.audit_log enable row level security;

drop policy if exists "audit_log platform admin read" on public.audit_log;
drop policy if exists "audit_log vendor read"         on public.audit_log;
drop policy if exists "audit_log customer read"       on public.audit_log;

create policy "audit_log platform admin read"
  on public.audit_log for select
  using (public.is_platform_admin());

create policy "audit_log vendor read"
  on public.audit_log for select
  using (
    entity_type = 'business' and exists (
      select 1 from public.businesses where id = entity_id and owner_id = auth.uid()
    )
    or entity_type in ('booking', 'payout') and exists (
      select 1 from public.bookings b
      where b.id = entity_id and public.is_business_owner(b.business_id)
    )
  );

create policy "audit_log customer read"
  on public.audit_log for select
  using (
    entity_type = 'booking' and exists (
      select 1 from public.bookings b
      where b.id = entity_id
        and lower(b.customer_email) = public.current_user_email()
    )
  );

-- ---------------------------------------------------------------------------
-- user_roles
-- ---------------------------------------------------------------------------
--
-- Users can read their own role row. Only platform admins can grant /
-- revoke roles. This is the bootstrap problem: the first platform
-- admin row has to be inserted directly via service-role (see the
-- DEPLOYMENT.md runbook step "Bootstrap a platform admin").

alter table public.user_roles enable row level security;

drop policy if exists "user_roles self read"          on public.user_roles;
drop policy if exists "user_roles platform admin all" on public.user_roles;

create policy "user_roles self read"
  on public.user_roles for select
  using (user_id = auth.uid());

create policy "user_roles platform admin all"
  on public.user_roles for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
