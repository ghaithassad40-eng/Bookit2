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

export function generateLocalBookingReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return `BK-${out}`;
}
