-- ============================================================
-- Bookit — Supabase advisor hardening
-- ============================================================
--
-- Applied 2026-05-16 against the Bookit production project. Closes
-- the 22 actionable WARN-level lints flagged by `get_advisors` on
-- the security ruleset.
--
-- The 8 remaining warnings (create_booking_atomic, cancel_booking_atomic,
-- join_waitlist, redeem_promo_code each flagged for anon + authenticated)
-- are intentional and documented:
--
--   Those four RPCs MUST be SECURITY DEFINER + exposed to anon /
--   authenticated because they're the *only* write path into bookings /
--   booking_equipment / waitlist_entries / promo_codes — RLS blocks
--   direct INSERT/UPDATE on purpose so all writes route through the
--   validated, ownership-checked function bodies. Switching them to
--   SECURITY INVOKER would re-introduce the direct-write bypass.
--
-- 1. Pin search_path on every SECURITY DEFINER helper.
-- ----------------------------------------------------------------
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.generate_booking_reference() set search_path = public, pg_temp;
alter function public.is_business_owner(uuid) set search_path = public, pg_temp;
alter function public.current_user_id() set search_path = public, pg_temp;
alter function public.current_user_email() set search_path = public, pg_temp;
alter function public.is_platform_admin() set search_path = public, pg_temp;
alter function public.reject_reserved_slug() set search_path = public, pg_temp;

-- 2. Revoke REST exposure on trigger-only functions. These exist only
--    as VEs for AFTER ... triggers; nobody should hit them via
--    /rest/v1/rpc/. Triggers run as the table owner regardless of
--    these grants.
-- ----------------------------------------------------------------
revoke execute on function public.audit_business_status_change() from public, anon, authenticated;
revoke execute on function public.audit_booking_status_change()  from public, anon, authenticated;
revoke execute on function public.audit_payout()                 from public, anon, authenticated;

-- 3. Drop older create_booking_atomic overloads.
--    Earlier migrations (0004 + 0011) both created create_booking_atomic
--    with different signatures. PostgREST resolution rules pick by
--    argument count + names so leaving multiple overloads in place is
--    a routing hazard. Keep only the 0011 version (with p_equipment).
-- ----------------------------------------------------------------
drop function if exists public.create_booking_atomic(
  uuid, uuid, uuid, uuid, text, text, text, text
);
drop function if exists public.create_booking_atomic(
  uuid, uuid, uuid, uuid, text, text, text, text,
  text, text, numeric, text, text, text
);

-- 4. Re-grant the surviving RPCs explicitly. Makes intent obvious in a
--    future review (no relying on default-`public` grants).
-- ----------------------------------------------------------------
revoke all on function public.create_booking_atomic(
  uuid, uuid, uuid, uuid, text, text, text, text, jsonb
) from public;
grant execute on function public.create_booking_atomic(
  uuid, uuid, uuid, uuid, text, text, text, text, jsonb
) to anon, authenticated;

revoke all on function public.cancel_booking_atomic(uuid) from public;
grant execute on function public.cancel_booking_atomic(uuid) to authenticated;

revoke all on function public.release_booking_payout(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.release_booking_payout(uuid, text, text) to service_role;

revoke all on function public.redeem_promo_code(uuid, text, numeric, text) from public;
grant execute on function public.redeem_promo_code(uuid, text, numeric, text) to anon, authenticated;

revoke all on function public.join_waitlist(uuid, uuid, text, text, text) from public;
grant execute on function public.join_waitlist(uuid, uuid, text, text, text) to anon, authenticated;
