-- ============================================================
-- Bookit — Row Level Security policies
-- ============================================================

alter table public.businesses        enable row level security;
alter table public.business_configs  enable row level security;
alter table public.services          enable row level security;
alter table public.staff             enable row level security;
alter table public.time_slots        enable row level security;
alter table public.bookings          enable row level security;

-- helper: is the current user the owner of the given business?
create or replace function public.is_business_owner(b_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.businesses
    where id = b_id and owner_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------
-- businesses
-- ----------------------------------------------------------------
drop policy if exists "businesses public read"  on public.businesses;
drop policy if exists "businesses owner write"  on public.businesses;
drop policy if exists "businesses owner update" on public.businesses;
drop policy if exists "businesses owner delete" on public.businesses;

create policy "businesses public read"
  on public.businesses for select
  using (is_active = true or owner_id = auth.uid());

create policy "businesses owner insert"
  on public.businesses for insert
  with check (owner_id = auth.uid());

create policy "businesses owner update"
  on public.businesses for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "businesses owner delete"
  on public.businesses for delete
  using (owner_id = auth.uid());

-- ----------------------------------------------------------------
-- business_configs
-- ----------------------------------------------------------------
drop policy if exists "configs public read"  on public.business_configs;
drop policy if exists "configs owner write"  on public.business_configs;

create policy "configs public read"
  on public.business_configs for select
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and (b.is_active or b.owner_id = auth.uid())
    )
  );

create policy "configs owner write"
  on public.business_configs for all
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- ----------------------------------------------------------------
-- services
-- ----------------------------------------------------------------
drop policy if exists "services public read" on public.services;
drop policy if exists "services owner write" on public.services;

create policy "services public read"
  on public.services for select
  using (
    is_active = true
    or public.is_business_owner(business_id)
  );

create policy "services owner write"
  on public.services for all
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- ----------------------------------------------------------------
-- staff
-- ----------------------------------------------------------------
drop policy if exists "staff public read" on public.staff;
drop policy if exists "staff owner write" on public.staff;

create policy "staff public read"
  on public.staff for select
  using (
    is_active = true
    or public.is_business_owner(business_id)
  );

create policy "staff owner write"
  on public.staff for all
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- ----------------------------------------------------------------
-- time_slots
-- ----------------------------------------------------------------
drop policy if exists "slots public read" on public.time_slots;
drop policy if exists "slots owner write" on public.time_slots;

create policy "slots public read"
  on public.time_slots for select
  using (true);

create policy "slots owner write"
  on public.time_slots for all
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- ----------------------------------------------------------------
-- bookings
-- ----------------------------------------------------------------
drop policy if exists "bookings public insert"   on public.bookings;
drop policy if exists "bookings owner read"      on public.bookings;
drop policy if exists "bookings owner update"    on public.bookings;
drop policy if exists "bookings owner delete"    on public.bookings;
drop policy if exists "bookings reference read"  on public.bookings;

-- public can create bookings
create policy "bookings public insert"
  on public.bookings for insert
  with check (true);

-- owners can read all bookings for their businesses
create policy "bookings owner read"
  on public.bookings for select
  using (public.is_business_owner(business_id));

create policy "bookings owner update"
  on public.bookings for update
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

create policy "bookings owner delete"
  on public.bookings for delete
  using (public.is_business_owner(business_id));
