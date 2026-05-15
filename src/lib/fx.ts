// Foreign-exchange utilities.
//
// In production we'd hit a live FX feed daily (ECB / openexchangerates /
// fixer.io) and cache the rates in Supabase. For the demo we use a static
// USD-pegged table that's accurate enough to demonstrate the UX. Rates are
// approximate values from May 2026; rotate to a live source before launch.
//
// The booking flow ALWAYS charges in the business's native currency at
// checkout time — FX is purely a display affordance for the customer so
// they can read prices in their own currency.

const USD_RATES: Record<string, number> = {
  // 1 USD = X local
  USD: 1,
  KWD: 0.307,    // pegged
  SAR: 3.75,     // pegged
  AED: 3.6725,   // pegged
  BHD: 0.376,    // pegged
  QAR: 3.64,     // pegged
  OMR: 0.3845,   // pegged
  EGP: 49.0,
  JOD: 0.709,
  GBP: 0.79,
  EUR: 0.92,
};

/**
 * Convert an amount between currencies via USD.
 * Returns the source amount unchanged when either currency is unsupported.
 */
export function convertPrice(amount: number, from: string, to: string): number {
  if (!from || !to || from.toUpperCase() === to.toUpperCase()) return amount;
  const fromRate = USD_RATES[from.toUpperCase()];
  const toRate = USD_RATES[to.toUpperCase()];
  if (!fromRate || !toRate) return amount;
  // amount -> USD -> target
  const usd = amount / fromRate;
  return usd * toRate;
}

/**
 * Format a price with optional FX conversion. Returns both the display
 * string in the target currency AND a "native" string showing what the
 * merchant actually charges. UI shows the display string prominently and
 * the native string as a small disclosure when they differ.
 */
export interface DisplayPrice {
  /** Localized number in the customer's display currency. */
  display: string;
  /** Localized number in the merchant's currency (what's actually charged). */
  native: string;
  /** True when display != native (FX conversion happened). */
  converted: boolean;
  displayCurrency: string;
  nativeCurrency: string;
  /** Raw numeric in display currency, for math. */
  displayAmount: number;
}

export function formatCustomerPrice(
  amount: number,
  merchantCurrency: string,
  displayCurrency: string,
  locale?: string,
): DisplayPrice {
  const sameCurrency = merchantCurrency.toUpperCase() === displayCurrency.toUpperCase();
  const converted = !sameCurrency && rateSupported(merchantCurrency, displayCurrency);

  const displayAmount = converted
    ? convertPrice(amount, merchantCurrency, displayCurrency)
    : amount;

  return {
    display: fmt(displayAmount, converted ? displayCurrency : merchantCurrency, locale),
    native: fmt(amount, merchantCurrency, locale),
    converted,
    displayCurrency: converted ? displayCurrency : merchantCurrency,
    nativeCurrency: merchantCurrency,
    displayAmount,
  };
}

function rateSupported(from: string, to: string): boolean {
  return !!(USD_RATES[from.toUpperCase()] && USD_RATES[to.toUpperCase()]);
}

function fmt(amount: number, currency: string, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
