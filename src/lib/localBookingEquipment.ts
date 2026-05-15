import type { BookingEquipmentRow } from "./database.types";

/**
 * Demo-mode persistence for booking_equipment rows (the junction between a
 * booking and the equipment lines the customer picked). The Confirmation
 * invoice reads these to render line items.
 */

const KEY = "bookit.demo.booking_equipment";

export function getLocalBookingEquipment(bookingId: string): BookingEquipmentRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as BookingEquipmentRow[];
    return all.filter((r) => r.booking_id === bookingId);
  } catch {
    return [];
  }
}

export function saveLocalBookingEquipment(rows: BookingEquipmentRow[]): void {
  if (typeof window === "undefined" || rows.length === 0) return;
  const all = (() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as BookingEquipmentRow[]) : [];
    } catch {
      return [] as BookingEquipmentRow[];
    }
  })();
  all.push(...rows);
  window.localStorage.setItem(KEY, JSON.stringify(all));
}

export function newBookingEquipmentId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `be-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `be-${Math.random().toString(36).slice(2, 10)}`;
}
