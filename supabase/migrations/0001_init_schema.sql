-- ============================================================
-- Bookit — Multi-tenant booking SaaS schema
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------
-- businesses
-- ----------------------------------------------------------------
create table if not exists public.businesses (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  industry     text not null,
  logo_url     text,
  owner_id     uuid references auth.users(id) on delete set null,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists businesses_slug_idx     on public.businesses(slug);
create index if not exists businesses_owner_idx    on public.businesses(owner_id);
create index if not exists businesses_industry_idx on public.businesses(industry);

-- ----------------------------------------------------------------
-- business_configs (one row per business)
-- ----------------------------------------------------------------
create table if not exists public.business_configs (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null unique references public.businesses(id) on delete cascade,
  theme_json          jsonb not null default '{}'::jsonb,
  copy_json           jsonb not null default '{}'::jsonb,
  booking_rules_json  jsonb not null default '{}'::jsonb,
  layout_json         jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists business_configs_business_idx on public.business_configs(business_id);

-- ----------------------------------------------------------------
-- services
-- ----------------------------------------------------------------
create table if not exists public.services (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses(id) on delete cascade,
  name              text not null,
  description       text,
  duration_minutes  integer not null check (duration_minutes > 0),
  price             numeric(10,2) not null default 0 check (price >= 0),
  currency          text not null default 'USD',
  capacity          integer not null default 1 check (capacity > 0),
  color             text default '#3B82F6',
  image_url         text,
  is_active         boolean not null default true,
  metadata_json     jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists services_business_idx on public.services(business_id);
create index if not exists services_active_idx   on public.services(business_id, is_active);

-- ----------------------------------------------------------------
-- staff
-- ----------------------------------------------------------------
create table if not exists public.staff (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references public.businesses(id) on delete cascade,
  name               text not null,
  role               text,
  specialty          text,
  bio                text,
  profile_photo_url  text,
  rating             numeric(3,2) default 5.0 check (rating between 0 and 5),
  is_active          boolean not null default true,
  metadata_json      jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists staff_business_idx on public.staff(business_id);
create index if not exists staff_active_idx   on public.staff(business_id, is_active);

-- ----------------------------------------------------------------
-- time_slots
-- ----------------------------------------------------------------
create table if not exists public.time_slots (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  service_id    uuid references public.services(id) on delete cascade,
  staff_id      uuid references public.staff(id) on delete set null,
  start_time    timestamptz not null,
  end_time      timestamptz not null,
  capacity      integer not null default 1 check (capacity > 0),
  booked_count  integer not null default 0 check (booked_count >= 0),
  status        text not null default 'open' check (status in ('open','closed','full','cancelled')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint time_slots_time_check check (end_time > start_time),
  constraint time_slots_capacity_check check (booked_count <= capacity)
);

create index if not exists time_slots_business_idx on public.time_slots(business_id);
create index if not exists time_slots_service_idx  on public.time_slots(service_id);
create index if not exists time_slots_staff_idx    on public.time_slots(staff_id);
create index if not exists time_slots_start_idx    on public.time_slots(business_id, start_time);
create index if not exists time_slots_status_idx   on public.time_slots(business_id, status);

-- ----------------------------------------------------------------
-- bookings
-- ----------------------------------------------------------------
create table if not exists public.bookings (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references public.businesses(id) on delete cascade,
  service_id         uuid not null references public.services(id) on delete restrict,
  staff_id           uuid references public.staff(id) on delete set null,
  slot_id            uuid not null references public.time_slots(id) on delete restrict,
  customer_name      text not null,
  customer_phone     text,
  customer_email     text,
  notes              text,
  booking_reference  text not null unique,
  status             text not null default 'confirmed' check (status in ('pending','confirmed','cancelled','completed','no_show')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists bookings_business_idx  on public.bookings(business_id);
create index if not exists bookings_slot_idx      on public.bookings(slot_id);
create index if not exists bookings_service_idx   on public.bookings(service_id);
create index if not exists bookings_staff_idx     on public.bookings(staff_id);
create index if not exists bookings_status_idx    on public.bookings(business_id, status);
create index if not exists bookings_created_idx   on public.bookings(business_id, created_at desc);
create index if not exists bookings_reference_idx on public.bookings(booking_reference);

-- ----------------------------------------------------------------
-- updated_at triggers
-- ----------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  for t in select unnest(array[
    'businesses','business_configs','services','staff','time_slots','bookings'
  ]) loop
    execute format(
      'drop trigger if exists trg_%1$s_updated_at on public.%1$s;
       create trigger trg_%1$s_updated_at before update on public.%1$s
       for each row execute function public.set_updated_at();',
      t
    );
  end loop;
end $$;

-- ----------------------------------------------------------------
-- booking reference generator
-- ----------------------------------------------------------------
create or replace function public.generate_booking_reference()
returns text language plpgsql as $$
declare
  ref text;
begin
  ref := upper(
    substring(
      replace(replace(encode(gen_random_bytes(6), 'base64'), '/', ''), '+', '')
      from 1 for 8
    )
  );
  return 'BK-' || ref;
end;
$$;

-- ----------------------------------------------------------------
-- atomic booking RPC (used by edge function and direct client calls)
-- ----------------------------------------------------------------
create or replace function public.create_booking_atomic(
  p_business_id   uuid,
  p_service_id    uuid,
  p_staff_id      uuid,
  p_slot_id       uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_notes         text
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot   public.time_slots%rowtype;
  v_ref    text;
  v_book   public.bookings%rowtype;
begin
  if p_customer_name is null or length(trim(p_customer_name)) = 0 then
    raise exception 'customer_name is required';
  end if;

  -- lock the row to prevent race conditions
  select * into v_slot
  from public.time_slots
  where id = p_slot_id and business_id = p_business_id
  for update;

  if not found then
    raise exception 'slot not found';
  end if;

  if v_slot.status <> 'open' then
    raise exception 'slot is not open';
  end if;

  if v_slot.booked_count >= v_slot.capacity then
    raise exception 'slot is at capacity';
  end if;

  if v_slot.start_time < now() then
    raise exception 'slot is in the past';
  end if;

  v_ref := public.generate_booking_reference();

  insert into public.bookings (
    business_id, service_id, staff_id, slot_id,
    customer_name, customer_phone, customer_email,
    notes, booking_reference, status
  ) values (
    p_business_id, p_service_id, p_staff_id, p_slot_id,
    trim(p_customer_name), p_customer_phone, p_customer_email,
    p_notes, v_ref, 'confirmed'
  )
  returning * into v_book;

  update public.time_slots
  set booked_count = booked_count + 1,
      status = case when booked_count + 1 >= capacity then 'full' else status end
  where id = p_slot_id;

  return v_book;
end;
$$;

grant execute on function public.create_booking_atomic(
  uuid, uuid, uuid, uuid, text, text, text, text
) to anon, authenticated;
