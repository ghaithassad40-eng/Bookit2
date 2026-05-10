-- ============================================================
-- Bookit — MyFatoorah-specific columns
-- ============================================================
-- Adds explicit invoice tracking for MyFatoorah on top of the generic
-- payment columns introduced in 0004_payments.sql.

alter table public.bookings
  add column if not exists provider               text,
  add column if not exists provider_invoice_id    text,
  add column if not exists provider_payment_url   text,
  add column if not exists provider_initiated_at  timestamptz;

create index if not exists bookings_provider_invoice_idx
  on public.bookings(provider, provider_invoice_id)
  where provider_invoice_id is not null;

-- ----------------------------------------------------------------
-- Allow service role (Edge Functions) to insert payment events.
-- The 0004 migration left INSERT closed to anon; production needs
-- writes from charge-payment / myfatoorah-* functions.
-- ----------------------------------------------------------------
drop policy if exists "payment_events service insert" on public.payment_events;

create policy "payment_events service insert"
  on public.payment_events for insert
  to service_role
  with check (true);

-- Allow business owners to update their booking's payment status if they
-- need to record a manual refund / mark cleared.
-- (write policy already exists from 0002; nothing to add)
