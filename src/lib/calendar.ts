// Generate a .ics (iCalendar) file for a confirmed booking and trigger a
// download. Works with Google Calendar, Apple Calendar, Outlook, Yahoo, etc.
// — every major calendar app accepts the same RFC 5545 format.

import type { BookingRow, BusinessRow, ServiceRow, StaffRow } from "./database.types";

interface BuildArgs {
  booking: BookingRow;
  business: BusinessRow;
  service: ServiceRow | null;
  staff: StaffRow | null;
  /** ISO start_time and end_time from the time slot. */
  start: string;
  end: string;
}

/** RFC 5545 needs CRLF newlines, escaped commas/semicolons, and lines ≤ 75 octets. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** Format JS Date → "20260514T160000Z" (UTC). */
function toIcsDateUtc(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

export function buildIcs({ booking, business, service, staff, start, end }: BuildArgs): string {
  const summary = service
    ? `${service.name} · ${business.name}`
    : `Booking · ${business.name}`;

  const description = [
    `Booking reference: ${booking.booking_reference}`,
    service ? `Service: ${service.name}` : null,
    staff ? `Specialist: ${staff.name}` : null,
    booking.notes ? `Notes: ${booking.notes}` : null,
  ]
    .filter(Boolean)
    .join("\\n");

  const location = [business.address, business.city, business.country]
    .filter(Boolean)
    .join(", ");

  const now = toIcsDateUtc(new Date().toISOString());
  const uid = `${booking.id}@bk-it.ai`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bookit//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${toIcsDateUtc(start)}`,
    `DTEND:${toIcsDateUtc(end)}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    location ? `LOCATION:${escapeText(location)}` : null,
    business.lat != null && business.lng != null
      ? `GEO:${business.lat};${business.lng}`
      : null,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText("Reminder: " + summary)}`,
    "TRIGGER:-PT30M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return lines.join("\r\n");
}

/** Trigger a browser download of the .ics file for the given booking. */
export function downloadIcs(args: BuildArgs): void {
  const ics = buildIcs(args);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${args.booking.booking_reference}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
