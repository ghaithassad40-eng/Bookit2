import type { BookingRow } from "./database.types";

const KEY = "bookit.demo.bookings";

export function getLocalBookings(): BookingRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as BookingRow[];
  } catch {
    return [];
  }
}

export function saveLocalBooking(booking: BookingRow): void {
  if (typeof window === "undefined") return;
  const list = getLocalBookings();
  list.push(booking);
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

/**
 * Patch an existing local booking by id. Returns the updated row, or null if
 * no booking with that id exists.
 */
export function updateLocalBooking(
  id: string,
  patch: Partial<BookingRow>,
): BookingRow | null {
  if (typeof window === "undefined") return null;
  const list = getLocalBookings();
  const idx = list.findIndex((b) => b.id === id);
  if (idx === -1) return null;
  const updated: BookingRow = {
    ...list[idx],
    ...patch,
    updated_at: new Date().toISOString(),
  };
  list[idx] = updated;
  window.localStorage.setItem(KEY, JSON.stringify(list));
  return updated;
}

/**
 * Generates a booking reference like "BK-XXXXXXXX" using a Crockford-style
 * alphabet (no 0/O/1/I confusion). The 8 random characters are drawn from a
 * 32-symbol alphabet — that's 40 bits of entropy, which makes naive booking-
 * reference enumeration attacks ineffective (the IDOR fix on Confirmation.tsx
 * is the real defense, but a stronger ref keeps the search space huge even
 * in the event of a later bug).
 *
 * Uses `crypto.getRandomValues` when available and falls back to
 * `Math.random()` only in the (legacy) case of a non-secure context — never
 * in the modern browsers we target. We reject values >= 32*8 = 256 via
 * rejection sampling so each character is uniformly distributed.
 */
export function generateLocalBookingReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 symbols
  const len = 8;

  const cryptoObj =
    typeof globalThis !== "undefined" && globalThis.crypto && "getRandomValues" in globalThis.crypto
      ? globalThis.crypto
      : null;

  let out = "";
  if (cryptoObj) {
    // Pull bytes in a small batch; reject any byte >= 256 (none) — we mask
    // with 0x1F to map into [0,31] uniformly (256 is divisible by 32, so no
    // modulo bias).
    const buf = new Uint8Array(len);
    cryptoObj.getRandomValues(buf);
    for (let i = 0; i < len; i++) {
      out += chars[buf[i] & 0x1f];
    }
  } else {
    // Non-secure context fallback. Demo-only, never reached in production
    // browsers, but keep it so unit tests / SSR don't crash.
    for (let i = 0; i < len; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return `BK-${out}`;
}
