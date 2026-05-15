import type { BusinessRow } from "./database.types";

/**
 * Tax (VAT) configuration per country.
 *
 * GCC tax landscape (as of 2026):
 *   KW — no VAT in force yet
 *   SA — VAT 15% (KSA-wide since Jul 2020)
 *   AE — VAT 5%
 *   BH — VAT 10% (raised from 5% in Jan 2022)
 *   QA — no VAT in force yet
 *   OM — VAT 5%
 *
 * Numbers above are statutory rates for general services. Some categories
 * (healthcare, certain education) qualify for zero-rated / exempt
 * treatment per local regulation — out of scope for this build; vendors
 * in those categories can disable VAT display from Settings entirely.
 *
 * Pricing convention
 * ------------------
 * Bookit follows the GCC consumer norm of *tax-inclusive* pricing: the
 * listed service price already contains VAT. On the invoice we then
 * split it back into subtotal + VAT so the customer can see what was
 * charged. This keeps the customer-visible price stable across
 * countries with different rates; only the receipt breakdown changes.
 */

export interface TaxConfig {
  /** ISO 3166-1 alpha-2 country code. */
  country: string;
  /** Statutory VAT rate. 0 means "no VAT in this country". */
  rate: number;
  /** Display name in EN / AR — used in the invoice line label. */
  name: { en: string; ar: string };
}

const TAX_BY_COUNTRY: Record<string, TaxConfig> = {
  KW: { country: "KW", rate: 0, name: { en: "VAT", ar: "ضريبة القيمة المضافة" } },
  SA: { country: "SA", rate: 0.15, name: { en: "VAT", ar: "ضريبة القيمة المضافة" } },
  AE: { country: "AE", rate: 0.05, name: { en: "VAT", ar: "ضريبة القيمة المضافة" } },
  BH: { country: "BH", rate: 0.10, name: { en: "VAT", ar: "ضريبة القيمة المضافة" } },
  QA: { country: "QA", rate: 0, name: { en: "VAT", ar: "ضريبة القيمة المضافة" } },
  OM: { country: "OM", rate: 0.05, name: { en: "VAT", ar: "ضريبة القيمة المضافة" } },
};

/** Country-default for whether VAT line items should be shown on receipts.
 *  Vendors can override per-business via `business.vat_registered`. */
export function countryHasVat(country: string | null | undefined): boolean {
  if (!country) return false;
  return (TAX_BY_COUNTRY[country.toUpperCase()]?.rate ?? 0) > 0;
}

/** Resolve the tax config that applies to a business. Combines the
 *  country's statutory rate with the vendor's VAT-registration flag —
 *  if the vendor isn't registered (under threshold / exempt category),
 *  rate effectively becomes 0 regardless of country. */
export function resolveTaxForBusiness(business: Pick<BusinessRow, "country" | "vat_registered">): TaxConfig {
  const fallback: TaxConfig = {
    country: business.country ?? "",
    rate: 0,
    name: { en: "VAT", ar: "ضريبة القيمة المضافة" },
  };
  if (!business.country) return fallback;
  const cfg = TAX_BY_COUNTRY[business.country.toUpperCase()];
  if (!cfg) return fallback;
  // Vendor opted out (not registered for VAT) → rate forced to 0.
  if (business.vat_registered === false) return { ...cfg, rate: 0 };
  return cfg;
}

export interface TaxSplit {
  /** Net amount before VAT — what the merchant earns. */
  subtotal: number;
  /** VAT portion of the gross amount. */
  tax: number;
  /** Gross amount — what the customer pays. Always equals subtotal + tax. */
  total: number;
  /** Rate as a decimal (0.15 for 15%). */
  rate: number;
}

/**
 * Split a tax-INCLUSIVE amount (the price as shown to the customer)
 * into subtotal + tax. Reverse of "add VAT on top of a base price".
 *
 *   gross = 100, rate = 0.15
 *   subtotal = 100 / 1.15 = 86.96
 *   tax      = 100 - 86.96 = 13.04
 *   total    = 100
 *
 * Numbers are rounded to 2 dp using "round half away from zero" so the
 * three components always reconcile (subtotal + tax === total exactly,
 * not "off by 0.01" from floating-point drift).
 */
export function splitTaxInclusive(gross: number, rate: number): TaxSplit {
  if (rate <= 0) {
    return { subtotal: roundTo2(gross), tax: 0, total: roundTo2(gross), rate: 0 };
  }
  const subtotal = roundTo2(gross / (1 + rate));
  const tax = roundTo2(gross - subtotal);
  return { subtotal, tax, total: subtotal + tax, rate };
}

/** Inverse: take a tax-EXCLUSIVE price and add VAT on top. Currently
 *  unused by the customer flow (which is tax-inclusive end-to-end) but
 *  kept available for B2B / export invoicing where tax-exclusive is
 *  the norm. */
export function addTaxOnTop(net: number, rate: number): TaxSplit {
  if (rate <= 0) {
    return { subtotal: roundTo2(net), tax: 0, total: roundTo2(net), rate: 0 };
  }
  const tax = roundTo2(net * rate);
  const subtotal = roundTo2(net);
  return { subtotal, tax, total: subtotal + tax, rate };
}

/** "VAT 15%" / "ض.ق.م ١٥٪" — used as the invoice line label. */
export function formatTaxLabel(cfg: TaxConfig, locale: "en" | "ar"): string {
  const pct = (cfg.rate * 100).toFixed(cfg.rate * 100 % 1 === 0 ? 0 : 2);
  return `${cfg.name[locale]} ${pct}%`;
}

function roundTo2(n: number): number {
  // "Round half away from zero" — avoids banker's-rounding surprises and
  // matches how invoices are rounded by every PSP we integrate with.
  return Math.sign(n) * Math.round(Math.abs(n) * 100) / 100;
}
