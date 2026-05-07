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

export function generateLocalBookingReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return `BK-${out}`;
}
