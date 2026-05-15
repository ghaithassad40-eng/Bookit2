// Saved payment methods for customers — demo-mode localStorage implementation.
//
// PRODUCTION NOTE: this MUST NOT store raw card data on real customers.
// In production, a saved payment method is just a PSP-issued token
// (MyFatoorah / Stripe / Adyen) plus enough display metadata (brand,
// last4, expiry) to render the card chooser. The token is what gets
// presented to the PSP when charging. Demo mode below fakes the token
// so the UX flows end-to-end without a PSP round-trip; see SECURITY.md
// punchlist for the production migration steps.

export type CardBrand =
  | "visa"
  | "mastercard"
  | "amex"
  | "knet"
  | "mada"
  | "apple_pay"
  | "google_pay"
  | "other";

export interface SavedPaymentMethod {
  id: string;
  /** Customer this card belongs to. */
  customer_id: string;
  brand: CardBrand;
  /** Display-only last 4 digits. Never the full PAN. */
  last4: string;
  /** Expiry in MM / YY format (numbers). */
  expMonth: number;
  expYear: number;
  cardholderName: string;
  /** Default card to charge — at most one per customer. */
  isDefault: boolean;
  /** Whether the customer authorised one-tap auto-pay for this card. */
  autoPay: boolean;
  /** PSP-issued token (demo: a fake random string). */
  token: string;
  createdAt: number;
}

const STORAGE_KEY = "bookit.customer.payment_methods";

function read(): SavedPaymentMethod[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedPaymentMethod[];
  } catch {
    return [];
  }
}

function write(list: SavedPaymentMethod[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  // Fire a custom event so any open Account pages refresh.
  window.dispatchEvent(new Event("bookit:customer-payment-methods"));
}

export function listPaymentMethods(customerId: string): SavedPaymentMethod[] {
  return read()
    .filter((p) => p.customer_id === customerId)
    .sort((a, b) =>
      a.isDefault === b.isDefault ? a.createdAt - b.createdAt : a.isDefault ? -1 : 1,
    );
}

export function getDefaultPaymentMethod(customerId: string): SavedPaymentMethod | null {
  return listPaymentMethods(customerId).find((p) => p.isDefault) ?? null;
}

export interface AddPaymentMethodInput {
  customer_id: string;
  brand: CardBrand;
  last4: string;
  expMonth: number;
  expYear: number;
  cardholderName: string;
  /** Make this the default card. Will demote any other default for this customer. */
  setDefault?: boolean;
  /** Authorise auto-pay (one-tap) for this card. */
  autoPay?: boolean;
}

export function addPaymentMethod(input: AddPaymentMethodInput): SavedPaymentMethod {
  const all = read();
  // If this is being marked default, demote any existing default first.
  if (input.setDefault) {
    for (const p of all) {
      if (p.customer_id === input.customer_id) p.isDefault = false;
    }
  }
  // First card automatically becomes the default.
  const hasOther = all.some((p) => p.customer_id === input.customer_id);
  const next: SavedPaymentMethod = {
    id: `pm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    customer_id: input.customer_id,
    brand: input.brand,
    last4: input.last4.replace(/\D/g, "").slice(-4).padStart(4, "0"),
    expMonth: input.expMonth,
    expYear: input.expYear,
    cardholderName: input.cardholderName.trim(),
    isDefault: input.setDefault ?? !hasOther,
    autoPay: input.autoPay ?? false,
    // Fake token. In production this would come back from the PSP after
    // a hosted-page card entry.
    token: `demo_tok_${Math.random().toString(36).slice(2, 18)}`,
    createdAt: Date.now(),
  };
  all.push(next);
  write(all);
  return next;
}

export function removePaymentMethod(id: string): void {
  const all = read();
  const idx = all.findIndex((p) => p.id === id);
  if (idx === -1) return;
  const removed = all.splice(idx, 1)[0];
  // If we removed the default, promote the next card (if any).
  if (removed?.isDefault) {
    const next = all.find((p) => p.customer_id === removed.customer_id);
    if (next) next.isDefault = true;
  }
  write(all);
}

export function setDefaultPaymentMethod(id: string): void {
  const all = read();
  const target = all.find((p) => p.id === id);
  if (!target) return;
  for (const p of all) {
    if (p.customer_id === target.customer_id) {
      p.isDefault = p.id === id;
    }
  }
  write(all);
}

export function setAutoPay(id: string, autoPay: boolean): void {
  const all = read();
  const target = all.find((p) => p.id === id);
  if (!target) return;
  target.autoPay = autoPay;
  write(all);
}

/** Subscribe to changes. Returns an unsubscribe fn. Mirrors the
 *  customerAuth subscription pattern. */
export function onPaymentMethodsChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onLocal = () => cb();
  const onStorage = (ev: StorageEvent) => {
    if (ev.key === STORAGE_KEY) cb();
  };
  window.addEventListener("bookit:customer-payment-methods", onLocal);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("bookit:customer-payment-methods", onLocal);
    window.removeEventListener("storage", onStorage);
  };
}

/** Detect card brand from the first digits of a card number entered in
 *  the demo "Add card" form. Very coarse — real card-brand detection
 *  uses BIN ranges and lives in the PSP. */
export function detectBrandFromNumber(num: string): CardBrand {
  const cleaned = num.replace(/\D/g, "");
  if (/^4/.test(cleaned)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(cleaned)) return "mastercard";
  if (/^(34|37)/.test(cleaned)) return "amex";
  // KW-issued KNET cards (debit-side) historically start with 6
  // — placeholder; real detection is BIN-based and out of scope here.
  if (/^6/.test(cleaned)) return "knet";
  // Saudi-issued mada cards have a published BIN list; in demo, treat
  // 9-prefix as a placeholder.
  if (/^9/.test(cleaned)) return "mada";
  return "other";
}
