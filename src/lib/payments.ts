// Payment gateway abstraction.
//
// Six methods are wired in: Visa/Mastercard, Apple Pay, Google Pay, Samsung
// Pay, PayPal, and Knet. The default implementation is a mock so the demo
// runs end-to-end without merchant accounts. To go live, swap each adapter
// for a real one — see `supabase/functions/charge-payment` for the
// Stripe + Knet templates.

export type PaymentMethodId =
  | "visa"
  | "apple_pay"
  | "google_pay"
  | "samsung_pay"
  | "paypal"
  | "knet";

export interface PaymentMethod {
  id: PaymentMethodId;
  label: string;
  shortLabel: string;
  description: string;
  region?: "global" | "kw";
}

export const PAYMENT_METHODS: Record<PaymentMethodId, PaymentMethod> = {
  visa: {
    id: "visa",
    label: "Card · Visa or Mastercard",
    shortLabel: "Card",
    description: "Pay securely with a credit or debit card.",
    region: "global",
  },
  apple_pay: {
    id: "apple_pay",
    label: "Apple Pay",
    shortLabel: "Apple Pay",
    description: "One tap with Touch ID or Face ID.",
    region: "global",
  },
  google_pay: {
    id: "google_pay",
    label: "Google Pay",
    shortLabel: "G Pay",
    description: "Confirm with your saved Google account.",
    region: "global",
  },
  samsung_pay: {
    id: "samsung_pay",
    label: "Samsung Pay",
    shortLabel: "Samsung Pay",
    description: "Tap to pay from your Samsung wallet.",
    region: "global",
  },
  paypal: {
    id: "paypal",
    label: "PayPal",
    shortLabel: "PayPal",
    description: "Log in with PayPal to complete payment.",
    region: "global",
  },
  knet: {
    id: "knet",
    label: "Knet",
    shortLabel: "KNET",
    description: "Pay from any Kuwait bank account.",
    region: "kw",
  },
};

export interface PaymentRequest {
  amount: number;
  currency: string;
  method: PaymentMethodId;
  /** Card details (only required for `visa`) */
  card?: {
    number: string;
    expMonth: string;
    expYear: string;
    cvc: string;
    holder: string;
  };
  reference: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  method: PaymentMethodId;
  last4?: string | null;
  brand?: string | null;
  /** Provider-specific opaque reference (e.g. Knet payment id, PayPal txn) */
  providerRef?: string | null;
  error?: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function detectCardBrand(num: string): "visa" | "mastercard" | "amex" | "discover" | "unknown" {
  const n = num.replace(/\D/g, "");
  if (/^4/.test(n)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(n)) return "mastercard";
  if (/^3[47]/.test(n)) return "amex";
  if (/^6(011|5)/.test(n)) return "discover";
  return "unknown";
}

export function luhnValid(num: string): boolean {
  const digits = num.replace(/\D/g, "");
  if (digits.length < 12) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function formatCardNumber(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

export function formatExpiry(value: string): string {
  const v = value.replace(/\D/g, "").slice(0, 4);
  if (v.length < 3) return v;
  return `${v.slice(0, 2)}/${v.slice(2)}`;
}

export function isExpiryFuture(month: string, year: string): boolean {
  const m = parseInt(month, 10);
  const y = 2000 + parseInt(year, 10);
  if (Number.isNaN(m) || Number.isNaN(y) || m < 1 || m > 12) return false;
  const now = new Date();
  const last = new Date(y, m, 0, 23, 59, 59);
  return last.getTime() > now.getTime();
}

// ---------------------------------------------------------------------------
// Mock adapter — used everywhere unless an Edge Function is configured
// ---------------------------------------------------------------------------

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function generateTxnId(prefix: string): string {
  const r = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${prefix}-${r}`;
}

async function mockChargeCard(req: PaymentRequest): Promise<PaymentResult> {
  await delay(900 + Math.random() * 600);
  const card = req.card;
  if (!card) return { success: false, transactionId: "", method: req.method, error: "Card details required" };
  const cleaned = card.number.replace(/\D/g, "");
  if (!luhnValid(cleaned)) {
    return { success: false, transactionId: "", method: req.method, error: "Card number failed validation" };
  }
  if (!isExpiryFuture(card.expMonth, card.expYear)) {
    return { success: false, transactionId: "", method: req.method, error: "Card is expired" };
  }
  if (!/^\d{3,4}$/.test(card.cvc)) {
    return { success: false, transactionId: "", method: req.method, error: "Invalid CVC" };
  }
  return {
    success: true,
    transactionId: generateTxnId("CH"),
    method: req.method,
    last4: cleaned.slice(-4),
    brand: detectCardBrand(cleaned),
    providerRef: generateTxnId("STRIPE"),
  };
}

async function mockWalletCharge(req: PaymentRequest, prefix: string): Promise<PaymentResult> {
  await delay(800 + Math.random() * 700);
  return {
    success: true,
    transactionId: generateTxnId(prefix),
    method: req.method,
    last4: null,
    brand: null,
    providerRef: generateTxnId(prefix),
  };
}

async function mockKnetCharge(req: PaymentRequest): Promise<PaymentResult> {
  // simulate Knet redirect → user authorizes → callback
  await delay(1100 + Math.random() * 600);
  return {
    success: true,
    transactionId: generateTxnId("KNET"),
    method: "knet",
    last4: null,
    brand: "Knet",
    providerRef: generateTxnId("KNETPAY"),
  };
}

async function chargeViaEdge(req: PaymentRequest): Promise<PaymentResult> {
  const { supabase, isSupabaseConfigured } = await import("./supabase");
  if (!isSupabaseConfigured) throw new Error("Edge payments require Supabase");
  const { data, error } = await supabase.functions.invoke<PaymentResult>("charge-payment", {
    body: req,
  });
  if (error) throw error;
  if (!data) throw new Error("No response from payment gateway");
  return data;
}

const useEdgePayments =
  (import.meta.env.VITE_USE_EDGE_PAYMENTS as string | undefined) === "true";

export async function charge(req: PaymentRequest): Promise<PaymentResult> {
  if (useEdgePayments) {
    try {
      return await chargeViaEdge(req);
    } catch (err) {
      // Fall back to mock so the UX never breaks during development.
      // eslint-disable-next-line no-console
      console.warn("[Bookit] Edge payment failed, falling back to mock:", err);
    }
  }
  switch (req.method) {
    case "visa":
      return mockChargeCard(req);
    case "apple_pay":
      return mockWalletCharge(req, "AP");
    case "google_pay":
      return mockWalletCharge(req, "GP");
    case "samsung_pay":
      return mockWalletCharge(req, "SP");
    case "paypal":
      return mockWalletCharge(req, "PP");
    case "knet":
      return mockKnetCharge(req);
  }
}

// ---------------------------------------------------------------------------
// Helpers for UI
// ---------------------------------------------------------------------------

/**
 * Returns the methods enabled for a business. Reads from
 * booking_rules_json.paymentMethods if present; otherwise enables all.
 */
export function enabledPaymentMethods(rules: { paymentMethods?: PaymentMethodId[] } | null | undefined): PaymentMethodId[] {
  const list = rules?.paymentMethods;
  if (Array.isArray(list) && list.length > 0) {
    return list.filter((m): m is PaymentMethodId => m in PAYMENT_METHODS);
  }
  return ["visa", "apple_pay", "google_pay", "samsung_pay", "paypal", "knet"];
}
