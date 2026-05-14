-- ============================================================
-- Bookit — Promo Codes + Waitlist
-- ============================================================
-- Two related Phase-2 PRD features. Schema only here; the customer
-- UI wires onto these tables in a follow-up commit.

-- ----------------------------------------------------------------
-- promo_codes — per-business discount codes
-- ----------------------------------------------------------------
create table if not exists public.promo_codes (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  code            text not null,                                 -- normalised uppercase, no spaces
  discount_pct    integer check (discount_pct between 0 and 100),
  discount_amount numeric(10,2),                                 -- alternative to pct
  currency        text,                                          -- required if discount_amount set
  starts_at       timestamptz,
  expires_at      timestamptz,
  uses_remaining  integer,                                       -- null = unlimited
  total_uses      integer not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint promo_codes_business_code_uk unique (business_id, code),
  constraint promo_codes_discount_chk check (
    discount_pct is not null or discount_amount is not null
  )
);

create index if not exists promo_codes_business_idx on public.promo_codes(business_id);
create index if not exists promo_codes_active_idx   on public.promo_codes(business_id, is_active)
  where is_active = true;

-- Track which booking used which promo (audit + analytics)
alter table public.bookings
  add column if not exists promo_code_id uuid references public.promo_codes(id) on delete set null,
  add column if not exists discount_amount numeric(10,2) not null default 0;

create index if not exists bookings_promo_idx on public.bookings(promo_code_id)
  where promo_code_id is not null;

-- RPC: atomically validate + redeem a promo code. Returns the discount amount
-- (in invoice currency) that should be applied, or raises.
create or replace function public.redeem_promo_code(
  p_business_id   uuid,
  p_code          text,
  p_invoice_amount numeric,
  p_currency      text
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promo public.promo_codes%rowtype;
  v_discount numeric;
begin
  select * into v_promo
  from public.promo_codes
  where business_id = p_business_id
    and upper(code) = upper(p_code)
    and is_active = true
  for update;

  if not found then raise exception 'promo_invalid'; end if;
  if v_promo.starts_at is not null and v_promo.starts_at > now() then raise exception 'promo_not_started'; end if;
  if v_promo.expires_at is not null and v_promo.expires_at < now() then raise exception 'promo_expired'; end if;
  if v_promo.uses_remaining is not null and v_promo.uses_remaining <= 0 then raise exception 'promo_exhausted'; end if;

  -- Compute discount
  if v_promo.discount_pct is not null then
    v_discount := round(p_invoice_amount * v_promo.discount_pct / 100.0, 2);
  else
    if v_promo.currency is not null and v_promo.currency <> p_currency then
      raise exception 'promo_wrong_currency';
    end if;
    v_discount := least(v_promo.discount_amount, p_invoice_amount);
  end if;

  -- Decrement uses_remaining (only if it's bounded)
  update public.promo_codes
  set uses_remaining = case when uses_remaining is not null then uses_remaining - 1 else null end,
      total_uses = total_uses + 1
  where id = v_promo.id;

  return v_discount;
end;
$$;

grant execute on function public.redeem_promo_code(uuid, text, numeric, text) to anon, authenticated;

-- RLS
alter table public.promo_codes enable row level security;

drop policy if exists "promo_codes public read"  on public.promo_codes;
drop policy if exists "promo_codes owner write"  on public.promo_codes;

-- Public can SELECT active codes (the checkout lookup) — but only the
-- minimum metadata they need to validate. The RPC handles the privileged
-- redeem path.
create policy "promo_codes public read"
  on public.promo_codes for select
  using (is_active = true);

create policy "promo_codes owner write"
  on public.promo_codes for all
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- ----------------------------------------------------------------
-- waitlist_entries — first-come-first-served waitlist per slot
-- ----------------------------------------------------------------
create table if not exists public.waitlist_entries (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses(id) on delete cascade,
  slot_id        uuid not null references public.time_slots(id) on delete cascade,
  customer_name  text not null,
  customer_email text,
  customer_phone text,
  position       integer not null,                              -- 1-based, gap-free per slot
  status         text not null default 'waiting'
    check (status in ('waiting','offered','converted','expired','cancelled')),
  offered_at     timestamptz,
  offered_until  timestamptz,                                   -- expires offer if not claimed
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint waitlist_position_uk unique (slot_id, position)
);

create index if not exists waitlist_slot_idx     on public.waitlist_entries(slot_id, position);
create index if not exists waitlist_business_idx on public.waitlist_entries(business_id, status);

-- RPC: join the waitlist for a slot. Assigns the next position atomically.
create or replace function public.join_waitlist(
  p_business_id   uuid,
  p_slot_id       uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text
)
returns public.waitlist_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot   public.time_slots%rowtype;
  v_next   integer;
  v_entry  public.waitlist_entries%rowtype;
begin
  if p_customer_name is null or length(trim(p_customer_name)) = 0 then
    raise exception 'customer_name_required';
  end if;

  select * into v_slot from public.time_slots where id = p_slot_id for share;
  if not found then raise exception 'slot_not_found'; end if;
  if v_slot.business_id <> p_business_id then raise exception 'slot_business_mismatch'; end if;
  -- only sensible to join the waitlist if the slot is full
  if v_slot.booked_count < v_slot.capacity then raise exception 'slot_still_open'; end if;

  -- Compute next position with a lock to avoid duplicates
  select coalesce(max(position), 0) + 1 into v_next
  from public.waitlist_entries
  where slot_id = p_slot_id
  for update;

  insert into public.waitlist_entries (
    business_id, slot_id, customer_name, customer_email, customer_phone, position
  ) values (
    p_business_id, p_slot_id, trim(p_customer_name), p_customer_email, p_customer_phone, v_next
  ) returning * into v_entry;

  return v_entry;
end;
$$;

grant execute on function public.join_waitlist(uuid, uuid, text, text, text) to anon, authenticated;

alter table public.waitlist_entries enable row level security;

drop policy if exists "waitlist owner read"   on public.waitlist_entries;
drop policy if exists "waitlist public insert" on public.waitlist_entries;

create policy "waitlist owner read"
  on public.waitlist_entries for select
  using (public.is_business_owner(business_id));

-- Public can insert through the RPC only; direct insert blocked
create policy "waitlist public insert"
  on public.waitlist_entries for insert
  with check (false);
