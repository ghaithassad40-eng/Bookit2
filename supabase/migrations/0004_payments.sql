-- ============================================================
-- Bookit — Payments schema
-- ============================================================

alter table public.bookings
  add column if not exists payment_method        text,
  add column if not exists payment_status        text check (
    payment_status in ('unpaid','pending','paid','refunded','failed')
  ),
  add column if not exists payment_amount        numeric(10,2),
  add column if not exists payment_currency      text,
  add column if not exists payment_transaction_id text,
  add column if not exists payment_provider_ref  text;

create index if not exists bookings_payment_status_idx
  on public.bookings(business_id, payment_status);

-- ----------------------------------------------------------------
-- payment_events — append-only audit trail of gateway interactions
-- (webhooks, refunds, retries). Useful for reconciliation.
-- ----------------------------------------------------------------
create table if not exists public.payment_events (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid references public.bookings(id) on delete cascade,
  business_id   uuid not null references public.businesses(id) on delete cascade,
  provider      text not null,
  event_type    text not null,
  amount        numeric(10,2),
  currency      text,
  transaction_id text,
  provider_ref  text,
  raw_payload   jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists payment_events_booking_idx  on public.payment_events(booking_id);
create index if not exists payment_events_business_idx on public.payment_events(business_id, created_at desc);

alter table public.payment_events enable row level security;

drop policy if exists "payment_events owner read"  on public.payment_events;
drop policy if exists "payment_events service insert" on public.payment_events;

create policy "payment_events owner read"
  on public.payment_events for select
  using (public.is_business_owner(business_id));

-- only service role (Edge Functions) writes payment events
create policy "payment_events service insert"
  on public.payment_events for insert
  with check (false);

-- ----------------------------------------------------------------
-- create_booking_atomic — extend signature to capture payment fields
-- ----------------------------------------------------------------
create or replace function public.create_booking_atomic(
  p_business_id   uuid,
  p_service_id    uuid,
  p_staff_id      uuid,
  p_slot_id       uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_notes         text,
  p_payment_method        text default null,
  p_payment_status        text default 'unpaid',
  p_payment_amount        numeric default null,
  p_payment_currency      text default null,
  p_payment_transaction_id text default null,
  p_payment_provider_ref  text default null
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

  select * into v_slot
  from public.time_slots
  where id = p_slot_id and business_id = p_business_id
  for update;

  if not found then raise exception 'slot not found'; end if;
  if v_slot.status <> 'open' then raise exception 'slot is not open'; end if;
  if v_slot.booked_count >= v_slot.capacity then raise exception 'slot is at capacity'; end if;
  if v_slot.start_time < now() then raise exception 'slot is in the past'; end if;

  v_ref := public.generate_booking_reference();

  insert into public.bookings (
    business_id, service_id, staff_id, slot_id,
    customer_name, customer_phone, customer_email,
    notes, booking_reference, status,
    payment_method, payment_status, payment_amount, payment_currency,
    payment_transaction_id, payment_provider_ref
  ) values (
    p_business_id, p_service_id, p_staff_id, p_slot_id,
    trim(p_customer_name), p_customer_phone, p_customer_email,
    p_notes, v_ref, 'confirmed',
    p_payment_method, coalesce(p_payment_status,'unpaid'),
    p_payment_amount, p_payment_currency,
    p_payment_transaction_id, p_payment_provider_ref
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
  uuid, uuid, uuid, uuid, text, text, text, text,
  text, text, numeric, text, text, text
) to anon, authenticated;
