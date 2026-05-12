// Automated escrow + commission split — frontend module.
//
// Mirrors the server-side `release_booking_payout(...)` SQL RPC so the
// demo flow can run end-to-end without a backend. Same math, same state
// machine, same idempotency. When Supabase is connected, the live RPC
// takes over and this module degrades to a read-only helper for the
// commission breakdown.

import type {
  BookingRow,
  BusinessRow,
  LedgerEntryRow,
  PayoutReason,
  PayoutRow,
  PayoutStatus,
} from "./database.types";
import { getLocalBookings } from "./localBookings";

// ---------------------------------------------------------------------------
// Local storage keys (demo mode)
// ---------------------------------------------------------------------------

const PAYOUTS_KEY = "bookit.demo.payouts";
const LEDGER_KEY  = "bookit.demo.ledger";

function readLS<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "[]") as T[];
  } catch {
    return [];
  }
}
function writeLS<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getLocalPayouts(businessId?: string): PayoutRow[] {
  const all = readLS<PayoutRow>(PAYOUTS_KEY);
  return businessId ? all.filter((p) => p.business_id === businessId) : all;
}

export function getLocalLedger(businessId?: string): LedgerEntryRow[] {
  const all = readLS<LedgerEntryRow>(LEDGER_KEY);
  return businessId ? all.filter((e) => e.business_id === businessId) : all;
}

// ---------------------------------------------------------------------------
// Pure: split calculator
// ---------------------------------------------------------------------------

export interface SplitBreakdown {
  gross: number;
  pspFee: number;
  platformFee: number;
  merchantAmount: number;
  commissionRate: number;       // 0..1
  currency: string;
}

/** Round to 2 dp the same way the SQL RPC does. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateSplit(
  gross: number,
  currency: string,
  commissionBps: number,
  pspFee = 0,
): SplitBreakdown {
  const safeGross = Math.max(0, gross);
  const platformFee = round2((safeGross * commissionBps) / 10_000);
  const merchantAmount = round2(safeGross - pspFee - platformFee);
  return {
    gross: safeGross,
    pspFee,
    platformFee,
    merchantAmount,
    commissionRate: commissionBps / 10_000,
    currency,
  };
}

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

export interface ReleaseEligibility {
  eligible: boolean;
  reason?: string;
}

export function isReleaseEligible(
  booking: BookingRow,
  business: BusinessRow | null,
): ReleaseEligibility {
  if (!booking) return { eligible: false, reason: "booking_not_found" };
  if (booking.payment_status !== "paid") return { eligible: false, reason: "not_paid" };
  if (booking.payout_status !== "held") return { eligible: false, reason: "not_held" };
  if (booking.status === "cancelled") return { eligible: false, reason: "cancelled" };
  if (business && !business.payouts_enabled) return { eligible: false, reason: "payouts_disabled" };
  return { eligible: true };
}

// ---------------------------------------------------------------------------
// Demo release — matches release_booking_payout(...) SQL RPC
// ---------------------------------------------------------------------------

export interface ReleaseInput {
  booking: BookingRow;
  business: BusinessRow;
  reason: PayoutReason;
  actor: string;
}

export interface ReleaseResult {
  payout: PayoutRow;
  ledger: LedgerEntryRow[];
  alreadyExisted: boolean;
}

function randomId(prefix: string): string {
  return (
    prefix +
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36).slice(-4)
  );
}

export function releaseBookingPayoutLocal(input: ReleaseInput): ReleaseResult {
  const { booking, business, reason, actor } = input;
  const idempotencyKey = `release:${booking.id}`;

  const existing = readLS<PayoutRow>(PAYOUTS_KEY).find(
    (p) => p.idempotency_key === idempotencyKey,
  );
  if (existing) {
    const ledger = readLS<LedgerEntryRow>(LEDGER_KEY).filter(
      (e) => e.payout_id === existing.id,
    );
    return { payout: existing, ledger, alreadyExisted: true };
  }

  const eligibility = isReleaseEligible(booking, business);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason ?? "ineligible");
  }

  const split = calculateSplit(
    booking.payment_amount ?? 0,
    booking.payment_currency ?? "USD",
    business.commission_bps,
    0,
  );

  if (split.merchantAmount <= 0) {
    throw new Error("non_positive_merchant_payout");
  }

  const now = new Date().toISOString();
  const payout: PayoutRow = {
    id: randomId("po-"),
    idempotency_key: idempotencyKey,
    booking_id: booking.id,
    business_id: business.id,
    gross_amount: split.gross,
    psp_fee: split.pspFee,
    platform_fee: split.platformFee,
    merchant_amount: split.merchantAmount,
    currency: split.currency,
    status: "pending_transfer",
    reason,
    actor,
    provider_transfer_id: null,
    provider: business.payout_provider,
    last_error: null,
    released_at: now,
    transferred_at: null,
    created_at: now,
    updated_at: now,
  };

  // Double-entry: every release writes 4 rows summing to 0.
  const ledger: LedgerEntryRow[] = [
    {
      id: randomId("le-"),
      account: "escrow",
      amount: -split.platformFee,
      currency: split.currency,
      kind: "platform_fee",
      booking_id: booking.id,
      payout_id: payout.id,
      business_id: business.id,
      created_at: now,
    },
    {
      id: randomId("le-"),
      account: "platform_revenue",
      amount: split.platformFee,
      currency: split.currency,
      kind: "platform_fee",
      booking_id: booking.id,
      payout_id: payout.id,
      business_id: business.id,
      created_at: now,
    },
    {
      id: randomId("le-"),
      account: "escrow",
      amount: -split.merchantAmount,
      currency: split.currency,
      kind: "merchant_payout",
      booking_id: booking.id,
      payout_id: payout.id,
      business_id: business.id,
      created_at: now,
    },
    {
      id: randomId("le-"),
      account: `merchant_payable:${business.id}`,
      amount: split.merchantAmount,
      currency: split.currency,
      kind: "merchant_payout",
      booking_id: booking.id,
      payout_id: payout.id,
      business_id: business.id,
      created_at: now,
    },
  ];

  writeLS(PAYOUTS_KEY, [...readLS<PayoutRow>(PAYOUTS_KEY), payout]);
  writeLS(LEDGER_KEY, [...readLS<LedgerEntryRow>(LEDGER_KEY), ...ledger]);

  return { payout, ledger, alreadyExisted: false };
}

/**
 * Simulate the second leg of the release: the actual PSP wire. In demo
 * we just flip the payout state to "transferred" after a short delay.
 */
export function markPayoutTransferredLocal(payoutId: string, providerTransferId: string): PayoutRow | null {
  const all = readLS<PayoutRow>(PAYOUTS_KEY);
  const i = all.findIndex((p) => p.id === payoutId);
  if (i < 0) return null;
  const now = new Date().toISOString();
  all[i] = {
    ...all[i],
    status: "transferred",
    provider_transfer_id: providerTransferId,
    transferred_at: now,
    updated_at: now,
  };
  writeLS(PAYOUTS_KEY, all);
  return all[i];
}

/** Flip the source booking's payout_status to 'completed' on local store. */
export function markBookingPayoutCompletedLocal(bookingId: string, payoutId: string): void {
  if (typeof window === "undefined") return;
  const raw = window.localStorage.getItem("bookit.demo.bookings");
  if (!raw) return;
  try {
    const list: BookingRow[] = JSON.parse(raw);
    const next = list.map((b) =>
      b.id === bookingId ? { ...b, payout_status: "completed" as const, payout_id: payoutId, released_at: new Date().toISOString() } : b,
    );
    window.localStorage.setItem("bookit.demo.bookings", JSON.stringify(next));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Auto-release: find every held booking whose service slot has ended +
// grace period elapsed, and release them. Called by the background hook
// and on first load.
// ---------------------------------------------------------------------------

export interface AutoReleaseRun {
  scanned: number;
  released: PayoutRow[];
  errors: { booking_id: string; error: string }[];
}

export function autoReleaseDueBookings(opts: {
  businesses: BusinessRow[];
  graceMinutes?: number;
  slotEndByBookingId?: Record<string, string>;  // optional injected slot end times
}): AutoReleaseRun {
  const grace = (opts.graceMinutes ?? 30) * 60_000;
  const now = Date.now();
  const bookings = getLocalBookings();
  const out: AutoReleaseRun = { scanned: bookings.length, released: [], errors: [] };

  for (const booking of bookings) {
    if (booking.payout_status !== "held") continue;
    const business = opts.businesses.find((b) => b.id === booking.business_id);
    if (!business) continue;

    // Use slot end_time if injected; otherwise fall back to created_at + a
    // sensible window so demo bookings auto-release within minutes.
    const slotEnd = opts.slotEndByBookingId?.[booking.id]
      ? new Date(opts.slotEndByBookingId[booking.id]).getTime()
      : new Date(booking.created_at).getTime() + 60 * 60_000;

    if (slotEnd + grace > now) continue;

    try {
      const result = releaseBookingPayoutLocal({
        booking,
        business,
        reason: "auto_release",
        actor: "system:cron",
      });
      const transferred = markPayoutTransferredLocal(
        result.payout.id,
        `MF-DEMO-${result.payout.id.slice(-6).toUpperCase()}`,
      );
      markBookingPayoutCompletedLocal(booking.id, result.payout.id);
      if (transferred) out.released.push(transferred);
    } catch (err) {
      out.errors.push({
        booking_id: booking.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Aggregates for the admin dashboard
// ---------------------------------------------------------------------------

export interface PayoutSummary {
  heldCount: number;
  heldAmount: number;
  releasedCount: number;
  releasedAmount: number;
  platformRevenue: number;
  merchantPayouts: number;
  failed: number;
  currency: string;
}

export function summarisePayouts(
  bookings: BookingRow[],
  payouts: PayoutRow[],
  businessId: string,
): PayoutSummary {
  const myBookings = bookings.filter((b) => b.business_id === businessId);
  const myPayouts  = payouts.filter((p) => p.business_id === businessId);
  const currency   = myBookings[0]?.payment_currency ?? myPayouts[0]?.currency ?? "USD";

  const held = myBookings.filter((b) => b.payout_status === "held" && b.payment_status === "paid");
  const transferred = myPayouts.filter((p) => p.status === "transferred");
  const failed = myPayouts.filter((p) => p.status === "transfer_failed").length;

  return {
    heldCount:        held.length,
    heldAmount:       held.reduce((s, b) => s + (b.payment_amount ?? 0), 0),
    releasedCount:    transferred.length,
    releasedAmount:   transferred.reduce((s, p) => s + p.merchant_amount, 0),
    platformRevenue:  transferred.reduce((s, p) => s + p.platform_fee, 0),
    merchantPayouts:  transferred.reduce((s, p) => s + p.merchant_amount, 0),
    failed,
    currency,
  };
}
