// Frontend MyFatoorah client.
//
// Two modes:
//   - Live: posts to the `myfatoorah-initiate` edge function which talks
//     to MyFatoorah's API. Returns a PaymentURL the customer is redirected
//     to. After paying they come back to /business/:slug/payment/callback
//     where we POST to `myfatoorah-callback` to verify.
//   - Demo: walks the user through a simulated MyFatoorah-like hosted page
//     so the flow is visible end-to-end without configuring credentials.
//
// Toggle live mode with VITE_MYFATOORAH_ENABLED=true.

import { isSupabaseConfigured, supabase } from "./supabase";
import { saveLocalBooking } from "./localBookings";
import type { PaymentMethodId, PaymentResult } from "./payments";

export const MYFATOORAH_ENABLED =
  (import.meta.env.VITE_MYFATOORAH_ENABLED as string | undefined) === "true" &&
  isSupabaseConfigured;

// Map our internal method ids to MyFatoorah's internal codes.
// MyFatoorah's PaymentMethodCode is what InitiatePayment returns; the edge
// function does the final id resolution server-side, but we forward the
// short name here so the dispatcher can pick the right `PaymentMethodId`.
export type MFMethod =
  | "visa"
  | "apple_pay"
  | "google_pay"
  | "samsung_pay"
  | "knet"
  | "mada"
  | "amex"
  | "stcpay"
  | "any";

export function toMyFatoorahMethod(id: PaymentMethodId): MFMethod {
  switch (id) {
    case "visa":
      return "visa";
    case "apple_pay":
      return "apple_pay";
    case "google_pay":
      return "google_pay";
    case "samsung_pay":
      return "samsung_pay";
    case "knet":
      return "knet";
    case "paypal":
      // MyFatoorah doesn't process PayPal directly; show all methods.
      return "any";
  }
}

export interface InitiateBody {
  method: MFMethod;
  amount: number;
  currency: string;
  reference: string;
  business_slug: string;
  customer: { name: string; phone?: string | null; email?: string | null };
  booking_id?: string | null;
}

export interface InitiateResponse {
  success: boolean;
  paymentUrl?: string;
  invoiceId?: number;
  customerReference?: string;
  error?: string;
}

export async function initiateMyFatoorahPayment(body: InitiateBody): Promise<InitiateResponse> {
  if (!MYFATOORAH_ENABLED) {
    // Demo mode — produce a fake hosted page URL we render ourselves.
    const fakeInvoice = Math.floor(1_000_000 + Math.random() * 9_000_000);
    const u = new URL(window.location.origin + `/payment/myfatoorah-mock`);
    u.searchParams.set("amount", body.amount.toFixed(2));
    u.searchParams.set("currency", body.currency);
    u.searchParams.set("reference", body.reference);
    u.searchParams.set("method", body.method);
    u.searchParams.set("invoiceId", String(fakeInvoice));
    u.searchParams.set("returnTo", `/business/${body.business_slug}/payment/callback?ref=${encodeURIComponent(body.reference)}`);
    return {
      success: true,
      paymentUrl: u.toString(),
      invoiceId: fakeInvoice,
      customerReference: body.reference,
    };
  }
  const { data, error } = await supabase.functions.invoke<InitiateResponse>("myfatoorah-initiate", {
    body,
  });
  if (error) return { success: false, error: error.message };
  return data ?? { success: false, error: "no response" };
}

export interface CallbackQuery {
  paymentId?: string | null;
  invoiceId?: string | null;
  reference?: string | null;
  error?: boolean;
}

export interface CallbackResult {
  success: boolean;
  status: string;
  transactionId: string | null;
  invoiceId: number | null;
  customerReference: string | null;
  amount: number | null;
  cardNumber: string | null;
  paymentGateway: string | null;
  error?: string;
}

export async function verifyMyFatoorahCallback(query: CallbackQuery): Promise<CallbackResult> {
  if (!MYFATOORAH_ENABLED) {
    // In demo mode, the mock page already sets a localStorage flag.
    const ref = query.reference ?? "";
    const decision = window.localStorage.getItem(`bookit.demo.mf.${ref}`);
    return {
      success: decision === "approved",
      status: decision === "approved" ? "Paid" : decision === "declined" ? "Failed" : "Pending",
      transactionId: decision ? `MF-${ref}` : null,
      invoiceId: query.invoiceId ? Number(query.invoiceId) : null,
      customerReference: ref,
      amount: null,
      cardNumber: null,
      paymentGateway: "MyFatoorah (demo)",
    };
  }
  const { data, error } = await supabase.functions.invoke<CallbackResult>("myfatoorah-callback", {
    body: {
      paymentId: query.paymentId,
      invoiceId: query.invoiceId,
      reference: query.reference,
    },
  });
  if (error) return { success: false, status: "error", transactionId: null, invoiceId: null, customerReference: null, amount: null, cardNumber: null, paymentGateway: null, error: error.message };
  return data ?? { success: false, status: "error", transactionId: null, invoiceId: null, customerReference: null, amount: null, cardNumber: null, paymentGateway: null, error: "no response" };
}

/** Convert MyFatoorah callback into our internal PaymentResult shape. */
export function callbackToPaymentResult(method: PaymentMethodId, cb: CallbackResult): PaymentResult {
  return {
    success: cb.success,
    transactionId: cb.transactionId ?? "",
    method,
    last4: cb.cardNumber?.slice(-4) ?? null,
    brand: cb.paymentGateway ?? null,
    providerRef: cb.invoiceId ? String(cb.invoiceId) : null,
    error: cb.error,
  };
}

/** Persist a draft booking before redirect so the callback page can complete it. */
const PENDING_KEY = "bookit.pending_booking";

export interface PendingBooking {
  reference: string;
  invoiceId: number | null;
  business_id: string;
  business_slug: string;
  service_id: string;
  staff_id: string | null;
  slot_id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  notes: string | null;
  amount: number;
  currency: string;
  method: PaymentMethodId;
  createdAt: number;
}

export function savePendingBooking(p: PendingBooking) {
  window.localStorage.setItem(PENDING_KEY, JSON.stringify(p));
}

export function loadPendingBooking(reference?: string): PendingBooking | null {
  const raw = window.localStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingBooking;
    if (reference && parsed.reference !== reference) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingBooking() {
  window.localStorage.removeItem(PENDING_KEY);
}

export { saveLocalBooking };
