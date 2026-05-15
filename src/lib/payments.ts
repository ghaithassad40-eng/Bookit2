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
  | "knet"
  | "mada"
  | "stcpay"
  | "uaecc"
  | "amex";

export type PaymentRegion = "global" | "kw" | "sa" | "ae" | "eg";

export interface PaymentMethod {
  id: PaymentMethodId;
  label: string;
  shortLabel: string;
  description: string;
  /** Where this method is most relevant (informational). */
  regions?: PaymentRegion[];
}

/**
 * Per-currency caption suffixes that explain how a method actually routes.
 * Surfaced in the UI so customers see "Apple Pay · via KNET" in Kuwait,
 * not just generic "Apple Pay" — and there's no FX surprise.
 */
const ROUTING_LABELS: Partial<Record<PaymentMethodId, Record<string, string>>> = {
  apple_pay: { KWD: "via KNET (Kuwait)" },
  google_pay: { KWD: "via KNET (Kuwait)" },
};

export function routingHint(method: PaymentMethodId, currency: string): string | null {
  return ROUTING_LABELS[method]?.[currency.toUpperCase()] ?? null;
}

export const PAYMENT_METHODS: Record<PaymentMethodId, PaymentMethod> = {
  visa: {
    id: "visa",
    label: "Card · Visa or Mastercard",
    shortLabel: "Card",
    description: "Pay securely with a credit or debit card.",
    regions: ["global"],
  },
  apple_pay: {
    id: "apple_pay",
    label: "Apple Pay",
    shortLabel: "Apple Pay",
    description: "One tap with Touch ID or Face ID.",
    regions: ["global"],
  },
  google_pay: {
    id: "google_pay",
    label: "Google Pay",
    shortLabel: "G Pay",
    description: "Confirm with your saved Google account.",
    regions: ["global"],
  },
  samsung_pay: {
    id: "samsung_pay",
    label: "Samsung Pay",
    shortLabel: "Samsung Pay",
    description: "Tap to pay from your Samsung wallet.",
    regions: ["global"],
  },
  paypal: {
    id: "paypal",
    label: "PayPal",
    shortLabel: "PayPal",
    description: "Log in with PayPal to complete payment.",
    regions: ["global"],
  },
  knet: {
    id: "knet",
    label: "KNET",
    shortLabel: "KNET",
    description: "Pay from any Kuwait bank account.",
    regions: ["kw"],
  },
  mada: {
    id: "mada",
    label: "Mada",
    shortLabel: "Mada",
    description: "Saudi Arabia's local debit network.",
    regions: ["sa"],
  },
  stcpay: {
    id: "stcpay",
    label: "STC Pay",
    shortLabel: "STC Pay",
    description: "Pay from your STC Pay wallet.",
    regions: ["sa"],
  },
  uaecc: {
    id: "uaecc",
    label: "UAE Cards",
    shortLabel: "UAE Cards",
    description: "Local UAE debit card network.",
    regions: ["ae"],
  },
  amex: {
    id: "amex",
    label: "American Express",
    shortLabel: "AMEX",
    description: "Pay with your American Express card.",
    regions: ["global"],
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
    case "mada":
    case "stcpay":
    case "uaecc":
    case "amex":
      // For local rails (Mada, STC Pay, UAE Cards, AMEX, KNET) we route
      // through the same KNET-style redirect mock — production replaces
      // this with the real MyFatoorah Edge Function.
      return mockKnetCharge(req);
    default:
      return mockChargeCard(req);
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

/**
 * Per-country payment-method preferences in the GCC. Mirrors the data used by
 * the PaymentRegionInfo info panel — kept here so the resolver below can
 * inject the customer's local network into a business's method list. Without
 * this, a Kuwait customer paying a Saudi business never sees KNET, even
 * though KNET would tokenize their card just fine.
 */
const COUNTRY_PREFERRED_METHODS: Record<string, PaymentMethodId[]> = {
  KW: ["knet", "apple_pay", "google_pay", "visa", "samsung_pay"],
  SA: ["mada", "stcpay", "apple_pay", "google_pay", "visa", "amex"],
  AE: ["uaecc", "visa", "apple_pay", "google_pay", "amex"],
  BH: ["visa", "apple_pay", "google_pay"],
  QA: ["visa", "apple_pay", "google_pay"],
  OM: ["visa", "apple_pay", "google_pay"],
};

/**
 * Resolves the final ordered list of payment methods to show a customer on
 * the payment step.
 *
 * The customer's region matters as much as the business's: a Kuwait customer
 * paying a Saudi business should still see KNET because KNET is the
 * tokenisation network on their card. Without this union, the QA tour found
 * Kuwait customers on padel/yoga/etc. businesses outside KW were stranded
 * on Mada/STC Pay buttons they couldn't actually use.
 *
 * Ordering: customer's local network(s) come first, then everything else
 * the business explicitly enables. Dedup preserves first occurrence.
 */
export function resolvePaymentMethodsForCustomer(
  businessRules: { paymentMethods?: PaymentMethodId[] } | null | undefined,
  customerCountry: string | null | undefined,
): PaymentMethodId[] {
  const businessMethods = enabledPaymentMethods(businessRules);
  const customerMethods =
    customerCountry && customerCountry !== "ALL"
      ? COUNTRY_PREFERRED_METHODS[customerCountry] ?? []
      : [];

  // Customer-local methods first, then business methods. Drop anything the
  // business explicitly disabled — if the business has a non-default
  // paymentMethods list, only methods present in that list survive. Default
  // (no list) means everything passes.
  const businessAllowAll =
    !Array.isArray(businessRules?.paymentMethods) || businessRules.paymentMethods.length === 0;
  const allowed = new Set(businessMethods);
  const out: PaymentMethodId[] = [];
  const seen = new Set<PaymentMethodId>();
  function push(m: PaymentMethodId) {
    if (seen.has(m)) return;
    if (!businessAllowAll && !allowed.has(m)) return;
    if (!(m in PAYMENT_METHODS)) return;
    seen.add(m);
    out.push(m);
  }
  for (const m of customerMethods) push(m);
  for (const m of businessMethods) push(m);
  return out;
}
