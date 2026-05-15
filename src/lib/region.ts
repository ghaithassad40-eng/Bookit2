// Country / region preference for the customer-facing site.
//
// On first visit we show a Welcome modal that asks for country + language.
// The choice is persisted to localStorage and used to:
//   - Filter the Home grid + concierge catalog to businesses in that country
//   - Default the booking-page currency
//   - Render the AI concierge in the chosen language

import { countryName as _name, countryFlag as _flag } from "./location";

// Bookit is GCC-only — the Gulf Cooperation Council member states.
// Kuwait, Saudi Arabia, UAE, Bahrain, Qatar, Oman.
export type CountryCode = "KW" | "SA" | "AE" | "BH" | "QA" | "OM" | "ALL";

export interface CountryMeta {
  code: CountryCode;
  /** English name */
  name: string;
  /** Arabic name */
  nameAr: string;
  flag: string;
  currency: string;
  timezones: string[];
}

export const COUNTRIES: CountryMeta[] = [
  { code: "KW", name: "Kuwait",       nameAr: "الكويت",   flag: _flag("KW"), currency: "KWD", timezones: ["Asia/Kuwait"] },
  { code: "SA", name: "Saudi Arabia", nameAr: "السعودية", flag: _flag("SA"), currency: "SAR", timezones: ["Asia/Riyadh"] },
  { code: "AE", name: "UAE",          nameAr: "الإمارات",  flag: _flag("AE"), currency: "AED", timezones: ["Asia/Dubai"] },
  { code: "BH", name: "Bahrain",      nameAr: "البحرين",   flag: _flag("BH"), currency: "BHD", timezones: ["Asia/Bahrain"] },
  { code: "QA", name: "Qatar",        nameAr: "قطر",       flag: _flag("QA"), currency: "QAR", timezones: ["Asia/Qatar"] },
  { code: "OM", name: "Oman",         nameAr: "عُمان",      flag: _flag("OM"), currency: "OMR", timezones: ["Asia/Muscat"] },
];

export const ALL_COUNTRY: CountryMeta = {
  code: "ALL",
  name: "All GCC countries",
  nameAr: "كل دول الخليج",
  flag: "🌍",
  currency: "USD",
  timezones: [],
};

const STORAGE_KEY = "bookit.country";

export function getStoredCountry(): CountryCode | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY) as CountryCode | null;
  if (!raw) return null;
  if (raw === "ALL") return "ALL";
  return COUNTRIES.find((c) => c.code === raw) ? raw : null;
}

export function setStoredCountry(code: CountryCode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, code);
}

export function clearStoredCountry(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/** Try to guess the customer's country from their browser timezone. */
export function detectCountry(): CountryCode | null {
  if (typeof Intl === "undefined") return null;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const hit = COUNTRIES.find((c) => c.timezones.includes(tz));
    return hit?.code ?? null;
  } catch {
    return null;
  }
}

export function countryMeta(code: CountryCode): CountryMeta {
  if (code === "ALL") return ALL_COUNTRY;
  return COUNTRIES.find((c) => c.code === code) ?? ALL_COUNTRY;
}

// Re-export utilities so callers don't have to remember which file they live in.
export const countryName = _name;
export const countryFlag = _flag;
