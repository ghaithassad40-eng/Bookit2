// Helpers for rendering business locations and linking out to mapping
// providers. We never embed Google Maps directly (that needs an API key
// and TOS approval) — instead we use OpenStreetMap for the in-page
// preview and link out to maps.google.com for navigation, which works on
// every device including Apple Maps via universal links.

import type { BusinessRow } from "./database.types";

export interface BusinessLocation {
  address: string;
  city: string | null;
  country: string | null;
  postalCode: string | null;
  lat: number;
  lng: number;
}

/** Returns null when the business has no usable coordinates. */
export function getLocation(b: BusinessRow): BusinessLocation | null {
  if (b.lat == null || b.lng == null || !b.address) return null;
  return {
    address: b.address,
    city: b.city,
    country: b.country,
    postalCode: b.postal_code,
    lat: b.lat,
    lng: b.lng,
  };
}

export function fullAddress(loc: BusinessLocation): string {
  return [loc.address, loc.city, loc.postalCode, loc.country]
    .filter(Boolean)
    .join(", ");
}

/** Open the place on Google Maps (works on web, Android Maps, Apple's universal link). */
export function googleMapsUrl(loc: BusinessLocation, label?: string): string {
  const q = encodeURIComponent(label ? `${label}, ${fullAddress(loc)}` : fullAddress(loc));
  return `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=&query_lat=${loc.lat}&query_lng=${loc.lng}`;
}

/** Turn-by-turn directions to the place. */
export function googleDirectionsUrl(loc: BusinessLocation): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`;
}

/** Apple Maps fallback (some users prefer it). */
export function appleMapsUrl(loc: BusinessLocation, label?: string): string {
  const q = encodeURIComponent(label ?? fullAddress(loc));
  return `http://maps.apple.com/?q=${q}&ll=${loc.lat},${loc.lng}`;
}

/** Waze deep-link. */
export function wazeUrl(loc: BusinessLocation): string {
  return `https://waze.com/ul?ll=${loc.lat},${loc.lng}&navigate=yes`;
}

/**
 * OpenStreetMap embed iframe URL — no API key, no tracking. Bbox is a small
 * window around the marker so the place appears centered.
 */
export function osmEmbedUrl(loc: BusinessLocation, deltaLat = 0.004, deltaLng = 0.004): string {
  const bbox = [loc.lng - deltaLng, loc.lat - deltaLat, loc.lng + deltaLng, loc.lat + deltaLat]
    .map((n) => n.toFixed(6))
    .join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${loc.lat},${loc.lng}`;
}

export type MapType = "m" | "k" | "h" | "p"; // map, satellite, hybrid, terrain

/**
 * Google Maps embed URL.
 *
 * Two modes:
 *   - If VITE_GOOGLE_MAPS_KEY is set, uses the official Embed API which gives
 *     us place details, satellite toggle, traffic layer, etc.
 *   - Otherwise uses the public `output=embed` URL which works without a key
 *     (covers ~95% of what customers need: pan, zoom, "View larger map"
 *     button that opens Google Maps proper, native marker).
 *
 * Both options surface the standard Google Maps UI customers recognise.
 */
export function googleMapsEmbedUrl(
  loc: BusinessLocation,
  options: { zoom?: number; type?: MapType; label?: string } = {},
): string {
  const zoom = options.zoom ?? 16;
  const type = options.type ?? "m";
  const key = (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: ImportMetaEnv })?.env?.VITE_GOOGLE_MAPS_KEY) as
    | string
    | undefined;

  if (key) {
    // Official Embed API → richer UI, optional satellite toggle.
    const q = encodeURIComponent(options.label ? `${options.label}` : `${loc.lat},${loc.lng}`);
    const mapMode = type === "k" || type === "h" ? "&maptype=satellite" : "";
    return `https://www.google.com/maps/embed/v1/place?key=${key}&q=${q}&center=${loc.lat},${loc.lng}&zoom=${zoom}${mapMode}`;
  }

  // No-key public embed. The pin and "View larger map" link are built-in.
  const q = encodeURIComponent(`${loc.lat},${loc.lng}`);
  return `https://www.google.com/maps?q=${q}&z=${zoom}&t=${type}&hl=en&output=embed`;
}

/** True when a Google Maps API key is configured (enables satellite toggle, etc.). */
export function hasGoogleMapsKey(): boolean {
  return Boolean(
    typeof import.meta !== "undefined" &&
      (import.meta as ImportMeta & { env?: ImportMetaEnv })?.env?.VITE_GOOGLE_MAPS_KEY,
  );
}

// ---------------------------------------------------------------------------
// Country / region helpers
// ---------------------------------------------------------------------------

// GCC countries (Kuwait, Saudi Arabia, UAE, Bahrain, Qatar, Oman).
const COUNTRY_NAMES: Record<string, string> = {
  KW: "Kuwait",
  SA: "Saudi Arabia",
  AE: "United Arab Emirates",
  BH: "Bahrain",
  QA: "Qatar",
  OM: "Oman",
};

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  KW: "KWD",
  SA: "SAR",
  AE: "AED",
  BH: "BHD",
  QA: "QAR",
  OM: "OMR",
};

export function countryName(code: string | null | undefined): string {
  if (!code) return "";
  return COUNTRY_NAMES[code.toUpperCase()] ?? code.toUpperCase();
}

export function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "";
  const base = 0x1f1e6 - "A".charCodeAt(0);
  const a = code.toUpperCase().charCodeAt(0);
  const b = code.toUpperCase().charCodeAt(1);
  return String.fromCodePoint(base + a) + String.fromCodePoint(base + b);
}

export function defaultCurrencyForCountry(code: string | null | undefined): string {
  if (!code) return "USD";
  return COUNTRY_TO_CURRENCY[code.toUpperCase()] ?? "USD";
}
