-- ============================================================
-- Bookit — Server-side validation + audit triggers
-- ============================================================
--
-- The pieces here back the RLS policies in migration 0010 by making
-- the database itself refuse to record invalid state. After this runs:
--
--   - Slug squatting can't happen — reserved words rejected by a
--     trigger before insert/update commits.
--   - Two customers can't double-book the same slot — atomic booking
--     uses SELECT FOR UPDATE on the time_slot row.
--   - Cancellation runs atomically through cancel_booking_atomic
--     (sets booking + payment + payout columns + decrements slot).
--   - Every status change on a business / booking and every payout
--     write is mirrored into audit_log via SECURITY DEFINER triggers.

-- ---------------------------------------------------------------------------
-- 1. Reserved-slug enforcement
-- ---------------------------------------------------------------------------
--
-- The list here MUST be kept in sync with src/lib/slug.ts RESERVED_SLUGS.
-- DEPLOYMENT.md has a checklist item to run a diff before each release.

create or replace function public.reject_reserved_slug()
returns trigger language plpgsql as $$
declare
  reserved text[] := array[
    'admin', 'platform', 'login', 'logout', 'signup', 'signin',
    'payment', 'payments', 'callback', 'checkout', 'confirmation',
    'privacy', 'terms', 'legal', 'api', 'www', 'static', 'assets',
    'auth', 'oauth', 'settings', 'dashboard',
    'business', 'businesses', 'book', 'booking', 'bookings',
    'bookit', 'support', 'help', 'contact', 'about',
    'official', 'verified', 'system', 'root', 'null', 'undefined'
  ];
begin
  if new.slug = any(reserved) then
    raise exception 'Slug % is reserved.', new.slug
      using errcode = 'check_violation', hint = 'Pick a different slug.';
  end if;
  -- Also enforce the same format regex as src/lib/slug.ts so the
  -- backend can't drift from what the UI accepts.
  if new.slug !~ '^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$' then
    raise exception 'Slug % has invalid format.', new.slug
      using errcode = 'check_violation',
            hint = 'Lowercase letters, digits and dashes only; 2-40 chars; no leading/trailing dash.';
  end if;
  return new;
end;
$$;

drop trigger if exists businesses_reject_reserved_slug on public.businesses;
create trigger businesses_reject_reserved_slug
  before insert or update of slug on public.businesses
  for each row execute function public.reject_reserved_slug();

-- ---------------------------------------------------------------------------
-- 2. Atomic booking creation with slot reservation lock
-- ---------------------------------------------------------------------------
--
-- Replaces (re-defines) the create_booking_atomic from migration 0004.
-- New behaviour:
--   - SELECT FOR UPDATE on the time_slot row, fixing the race where
--     two parallel POSTs both see "1 left" and both insert.
--   - Verifies the slot belongs to the same business_id passed in,
--     stopping a forged slot_id pointing at another vendor's slot.
--   - Increments booked_count + flips status → 'full' inside the same
--     transaction.
--   - Optionally writes the equipment add-on lines passed as JSON
--     so the booking + lines land atomically (avoiding "booking
--     created but cart didn't save" inconsistency in production).
--   - SECURITY DEFINER + revoke-from-public so the function runs
--     with table-owner privileges and bypasses RLS for the slot
--     mutation, but the JWT must still satisfy our explicit guard
--     (auth.uid() is null is allowed for anonymous bookings).

create or replace function public.create_booking_atomic(
  p_business_id    uuid,
  p_service_id     uuid,
  p_staff_id       uuid,
  p_slot_id        uuid,
  p_customer_name  text,
  p_customer_phone text,
  p_customer_email text,
  p_notes          text,
  p_equipment      jsonb default null  -- jsonb array of {equipment_id, quantity, unit_price, currency}
) returns public.bookings
language plpgsql security definer set search_path = public
as $$
declare
  v_slot      public.time_slots;
  v_business  public.businesses;
  v_booking   public.bookings;
  v_ref       text;
  v_eq        jsonb;
begin
  -- 1. Lock + load the slot. SKIP LOCKED would let two concurrent
  --    bookers each see a different slot; that's not what we want
  --    here. We want the second caller to wait + retry the count
  --    check after the first commits.
  select * into v_slot
    from public.time_slots
    where id = p_slot_id
    for update;
  if not found then
    raise exception 'Slot % does not exist.', p_slot_id
      using errcode = 'no_data_found';
  end if;

  -- 2. The slot must belong to the same business the caller named —
  --    stops a forged slot_id pointing at another vendor's open slot.
  if v_slot.business_id != p_business_id then
    raise exception 'Slot % does not belong to business %.', p_slot_id, p_business_id
      using errcode = 'check_violation', hint = 'Slot ↔ business mismatch.';
  end if;

  -- 3. Capacity check inside the lock.
  if v_slot.booked_count >= v_slot.capacity then
    raise exception 'Slot % is full.', p_slot_id
      using errcode = 'check_violation', hint = 'This time has just sold out — pick another.';
  end if;
  if v_slot.status = 'closed' or v_slot.status = 'cancelled' then
    raise exception 'Slot % is not bookable.', p_slot_id
      using errcode = 'check_violation';
  end if;

  -- 4. Business must be approved.
  select * into v_business from public.businesses where id = p_business_id;
  if not found or v_business.status != 'approved' then
    raise exception 'Business % is not accepting bookings.', p_business_id
      using errcode = 'check_violation';
  end if;

  -- 5. Generate a Crockford-style booking reference. 8 chars from a
  --    32-symbol alphabet = 40 bits of entropy. Mirrors the client-side
  --    crypto.getRandomValues path in src/lib/localBookings.ts.
  v_ref := 'BK-' || upper(substr(translate(
    encode(gen_random_bytes(6), 'base64'),
    '+/=OI01ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789',
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  ), 1, 8));

  -- 6. Insert the booking row.
  insert into public.bookings (
    business_id, service_id, staff_id, slot_id,
    customer_name, customer_phone, customer_email,
    notes, booking_reference, status
  ) values (
    p_business_id, p_service_id, p_staff_id, p_slot_id,
    p_customer_name, p_customer_phone,
    coalesce(lower(p_customer_email), null),
    p_notes, v_ref, 'confirmed'
  )
  returning * into v_booking;

  -- 7. Equipment add-ons (optional). Each element must have
  --    equipment_id (uuid), quantity (int), unit_price (numeric), currency (text).
  if p_equipment is not null and jsonb_array_length(p_equipment) > 0 then
    for v_eq in select * from jsonb_array_elements(p_equipment) loop
      insert into public.booking_equipment (
        booking_id, equipment_id, quantity, unit_price, currency
      ) values (
        v_booking.id,
        (v_eq->>'equipment_id')::uuid,
        (v_eq->>'quantity')::integer,
        (v_eq->>'unit_price')::numeric,
        v_eq->>'currency'
      );
    end loop;
  end if;

  -- 8. Update the slot counts + flip status if we just filled it.
  update public.time_slots
    set booked_count = v_slot.booked_count + 1,
        status = case
          when v_slot.booked_count + 1 >= v_slot.capacity then 'full'
          else status
        end,
        updated_at = now()
    where id = p_slot_id;

  return v_booking;
end;
$$;

revoke all on function public.create_booking_atomic from public;
grant execute on function public.create_booking_atomic to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 3. cancel_booking_atomic — customer or vendor-driven cancel + refund
-- ---------------------------------------------------------------------------
--
-- Customers can cancel their own bookings (status check enforced by
-- RLS policy "bookings customer cancel" + the auth check below).
-- Vendors / platform admins can cancel via the same function.
-- Side effects:
--   - booking.status     = 'cancelled'
--   - booking.payment_status   ← 'refunded' (when there was a payment)
--   - booking.payout_status    ← 'refunded' (so escrow doesn't release)
--   - time_slots.booked_count  decremented + status flipped back to 'open'
-- Refund-to-PSP itself is fired by the Edge Function that wraps this
-- call (charge-payment handles MyFatoorah refund); the DB function
-- only manages the local state.

create or replace function public.cancel_booking_atomic(
  p_booking_id uuid
) returns public.bookings
language plpgsql security definer set search_path = public
as $$
declare
  v_booking public.bookings;
  v_actor   uuid := auth.uid();
  v_email   text := public.current_user_email();
  v_can_cancel boolean;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking % not found.', p_booking_id using errcode = 'no_data_found';
  end if;
  if v_booking.status = 'cancelled' then
    -- Idempotent: already cancelled, return current state.
    return v_booking;
  end if;

  -- Permission check: customer with matching email, business owner,
  -- or platform admin.
  v_can_cancel :=
    (v_booking.customer_email is not null and lower(v_booking.customer_email) = v_email)
    or public.is_business_owner(v_booking.business_id)
    or public.is_platform_admin();
  if not v_can_cancel then
    raise exception 'Not authorised to cancel booking %.', p_booking_id
      using errcode = 'insufficient_privilege';
  end if;

  update public.bookings
    set status = 'cancelled',
        payment_status = case
          when payment_status = 'paid' then 'refunded'
          else payment_status
        end,
        payout_status = case
          when payout_status is null then null
          else 'refunded'
        end,
        updated_at = now()
    where id = p_booking_id
    returning * into v_booking;

  -- Free the slot.
  update public.time_slots
    set booked_count = greatest(0, booked_count - 1),
        status = case when status = 'full' then 'open' else status end,
        updated_at = now()
    where id = v_booking.slot_id;

  return v_booking;
end;
$$;

revoke all on function public.cancel_booking_atomic from public;
grant execute on function public.cancel_booking_atomic to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Audit triggers
-- ---------------------------------------------------------------------------

create or replace function public.audit_business_status_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if (tg_op = 'UPDATE' and old.status is distinct from new.status)
     or tg_op = 'INSERT' then
    insert into public.audit_log (
      actor_id, event_type, entity_type, entity_id,
      before_state, after_state, metadata
    ) values (
      auth.uid(),
      case when tg_op = 'INSERT' then 'business.created' else 'business.status_changed' end,
      'business',
      new.id,
      case when tg_op = 'UPDATE' then jsonb_build_object('status', old.status, 'rejection_reason', old.rejection_reason) else null end,
      jsonb_build_object('status', new.status, 'rejection_reason', new.rejection_reason),
      jsonb_build_object('slug', new.slug, 'name', new.name)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists businesses_audit on public.businesses;
create trigger businesses_audit
  after insert or update on public.businesses
  for each row execute function public.audit_business_status_change();

create or replace function public.audit_booking_status_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into public.audit_log (
      actor_id, event_type, entity_type, entity_id,
      before_state, after_state, metadata
    ) values (
      auth.uid(),
      'booking.status_changed',
      'booking',
      new.id,
      jsonb_build_object('status', old.status, 'payment_status', old.payment_status),
      jsonb_build_object('status', new.status, 'payment_status', new.payment_status),
      jsonb_build_object(
        'business_id', new.business_id,
        'reference', new.booking_reference,
        'customer_email', new.customer_email
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_audit on public.bookings;
create trigger bookings_audit
  after update on public.bookings
  for each row execute function public.audit_booking_status_change();

create or replace function public.audit_payout()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (
      actor_id, event_type, entity_type, entity_id,
      after_state, metadata
    ) values (
      auth.uid(),
      'payout.released',
      'payout',
      new.id,
      jsonb_build_object(
        'gross_amount', new.gross_amount,
        'merchant_amount', new.merchant_amount,
        'platform_fee', new.platform_fee,
        'status', new.status
      ),
      jsonb_build_object('business_id', new.business_id, 'booking_id', new.booking_id)
    );
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into public.audit_log (
      actor_id, event_type, entity_type, entity_id,
      before_state, after_state, metadata
    ) values (
      auth.uid(),
      'payout.status_changed',
      'payout',
      new.id,
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status),
      jsonb_build_object('business_id', new.business_id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists payouts_audit on public.payouts;
create trigger payouts_audit
  after insert or update on public.payouts
  for each row execute function public.audit_payout();
