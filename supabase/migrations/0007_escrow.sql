-- ============================================================
-- Bookit — Automated Escrow + Commission Split
-- ============================================================
-- Adds the schema for: funds-held-in-escrow per booking, deterministic
-- split (platform fee netted at settlement, merchant payout transferred
-- on release), an append-only double-entry ledger that is the source of
-- truth, and a release RPC that's idempotent on booking_id.

-- ----------------------------------------------------------------
-- 1. businesses — marketplace + commission config
-- ----------------------------------------------------------------
alter table public.businesses
  add column if not exists connected_account_id text,            -- PSP sub-account
  add column if not exists commission_bps       integer not null default 1000  -- 10.00%
    check (commission_bps between 0 and 5000),
  add column if not exists payouts_enabled      boolean not null default false,
  add column if not exists iban_last4           text,            -- display only
  add column if not exists payout_provider      text not null default 'myfatoorah';

create index if not exists businesses_connected_idx
  on public.businesses(connected_account_id)
  where connected_account_id is not null;

-- ----------------------------------------------------------------
-- 2. bookings — payout lifecycle
-- ----------------------------------------------------------------
alter table public.bookings
  add column if not exists payout_status text
    check (payout_status in ('held','releasing','completed','transfer_failed','refunded'))
    default 'held',
  add column if not exists payout_id     uuid,
  add column if not exists released_at   timestamptz;

create index if not exists bookings_payout_status_idx
  on public.bookings(business_id, payout_status);

-- ----------------------------------------------------------------
-- 3. payouts — one row per release intent (idempotent on booking_id)
-- ----------------------------------------------------------------
create table if not exists public.payouts (
  id                    uuid primary key default gen_random_uuid(),
  idempotency_key       text not null unique,                    -- 'release:<booking_id>'
  booking_id            uuid not null unique references public.bookings(id) on delete cascade,
  business_id           uuid not null references public.businesses(id) on delete cascade,

  -- amounts (minor units kept in numeric for cross-currency safety)
  gross_amount          numeric(12,2) not null check (gross_amount >= 0),
  psp_fee               numeric(12,2) not null default 0 check (psp_fee >= 0),
  platform_fee          numeric(12,2) not null default 0 check (platform_fee >= 0),
  merchant_amount       numeric(12,2) not null check (merchant_amount >= 0),
  currency              text not null,

  -- lifecycle
  status                text not null default 'pending_transfer'
    check (status in ('pending_transfer','transferred','transfer_failed','reversed')),
  reason                text not null
    check (reason in ('service_completed','auto_release','manual_override','cancellation_window_expired')),
  actor                 text not null,                           -- user id or 'system:cron'

  -- provider linkage (filled after the PSP transfer call)
  provider_transfer_id  text,
  provider              text not null default 'myfatoorah',
  last_error            text,

  released_at           timestamptz not null default now(),
  transferred_at        timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists payouts_business_idx     on public.payouts(business_id, created_at desc);
create index if not exists payouts_status_idx       on public.payouts(status);
create index if not exists payouts_unsettled_idx    on public.payouts(status, created_at)
  where status in ('pending_transfer','transfer_failed');

-- Now FK bookings.payout_id → payouts.id (after table exists)
alter table public.bookings
  drop constraint if exists bookings_payout_id_fkey,
  add  constraint bookings_payout_id_fkey
    foreign key (payout_id) references public.payouts(id) on delete set null;

-- ----------------------------------------------------------------
-- 4. ledger_entries — append-only double-entry book
-- ----------------------------------------------------------------
-- Every release writes 4 rows: 2 for the platform-fee leg, 2 for the
-- merchant-payout leg. Sum(amount) per booking_id MUST equal zero.
create table if not exists public.ledger_entries (
  id            uuid primary key default gen_random_uuid(),
  account       text not null,                                   -- e.g. 'escrow', 'platform_revenue', 'merchant_payable:<biz_id>'
  amount        numeric(12,2) not null,                          -- signed: + credit, − debit
  currency      text not null,
  kind          text not null check (kind in ('platform_fee','merchant_payout','reversal')),
  booking_id    uuid references public.bookings(id) on delete cascade,
  payout_id     uuid references public.payouts(id) on delete cascade,
  business_id   uuid references public.businesses(id) on delete cascade,
  created_at    timestamptz not null default now()
);

create index if not exists ledger_entries_account_idx  on public.ledger_entries(account, created_at desc);
create index if not exists ledger_entries_booking_idx  on public.ledger_entries(booking_id);
create index if not exists ledger_entries_business_idx on public.ledger_entries(business_id);

-- ----------------------------------------------------------------
-- 5. release_booking_payout(p_booking_id, p_reason, p_actor)
-- ----------------------------------------------------------------
-- Atomic release. Validates eligibility, writes the ledger entries,
-- creates a payouts row, and flips the booking to 'releasing'. The PSP
-- transfer call is performed by the caller (Edge Function or worker)
-- — this RPC only commits intent.
create or replace function public.release_booking_payout(
  p_booking_id uuid,
  p_reason     text,
  p_actor      text
)
returns public.payouts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking   public.bookings%rowtype;
  v_business  public.businesses%rowtype;
  v_gross     numeric(12,2);
  v_psp_fee   numeric(12,2);
  v_plat_fee  numeric(12,2);
  v_merch     numeric(12,2);
  v_idem      text;
  v_payout    public.payouts%rowtype;
  v_existing  public.payouts%rowtype;
  v_dispute   integer;
begin
  v_idem := 'release:' || p_booking_id::text;

  -- Short-circuit if we've already released this booking.
  select * into v_existing from public.payouts where idempotency_key = v_idem;
  if found then
    return v_existing;
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'booking_not_found'; end if;
  if v_booking.payment_status <> 'paid' then raise exception 'booking_not_paid'; end if;
  if v_booking.payout_status  <> 'held' then raise exception 'booking_not_holding'; end if;

  -- placeholder for future dispute table; for now we trust booking.status
  if v_booking.status = 'cancelled' then raise exception 'booking_cancelled'; end if;

  select * into v_business from public.businesses where id = v_booking.business_id;
  if not v_business.payouts_enabled then raise exception 'business_payouts_disabled'; end if;

  v_gross    := coalesce(v_booking.payment_amount, 0);
  v_psp_fee  := 0;  -- can be hydrated from booking metadata later
  v_plat_fee := round(v_gross * v_business.commission_bps / 10000.0, 2);
  v_merch    := v_gross - v_psp_fee - v_plat_fee;

  if v_merch <= 0 then raise exception 'non_positive_merchant_payout'; end if;

  -- Create payout row first (so ledger entries can reference it).
  insert into public.payouts (
    idempotency_key, booking_id, business_id,
    gross_amount, psp_fee, platform_fee, merchant_amount, currency,
    status, reason, actor, provider
  ) values (
    v_idem, p_booking_id, v_booking.business_id,
    v_gross, v_psp_fee, v_plat_fee, v_merch, v_booking.payment_currency,
    'pending_transfer', p_reason, p_actor, v_business.payout_provider
  ) returning * into v_payout;

  -- Double-entry ledger: every release writes exactly 4 rows summing to 0.
  insert into public.ledger_entries (account, amount, currency, kind, booking_id, payout_id, business_id) values
    ('escrow',                                              -v_plat_fee, v_booking.payment_currency, 'platform_fee',    p_booking_id, v_payout.id, v_business.id),
    ('platform_revenue',                                     v_plat_fee, v_booking.payment_currency, 'platform_fee',    p_booking_id, v_payout.id, v_business.id),
    ('escrow',                                              -v_merch,    v_booking.payment_currency, 'merchant_payout', p_booking_id, v_payout.id, v_business.id),
    ('merchant_payable:' || v_business.id::text,             v_merch,    v_booking.payment_currency, 'merchant_payout', p_booking_id, v_payout.id, v_business.id);

  -- Flip the booking.
  update public.bookings
  set payout_status = 'releasing',
      payout_id     = v_payout.id,
      released_at   = now()
  where id = p_booking_id;

  return v_payout;
end;
$$;

grant execute on function public.release_booking_payout(uuid, text, text)
  to anon, authenticated, service_role;

-- ----------------------------------------------------------------
-- 6. RLS
-- ----------------------------------------------------------------
alter table public.payouts        enable row level security;
alter table public.ledger_entries enable row level security;

drop policy if exists "payouts owner read"   on public.payouts;
drop policy if exists "ledger owner read"    on public.ledger_entries;

create policy "payouts owner read"
  on public.payouts for select
  using (public.is_business_owner(business_id));

create policy "ledger owner read"
  on public.ledger_entries for select
  using (business_id is null or public.is_business_owner(business_id));

-- Only service role writes payouts + ledger (driven by the RPC / Edge Function).
