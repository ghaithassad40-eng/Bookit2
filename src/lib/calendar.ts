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

// ─── Vendor calendar feed ──────────────────────────────────────────────────

interface FeedEventInput {
  booking: BookingRow;
  service: ServiceRow | null;
  staff: StaffRow | null;
  start: string;
  end: string;
}

interface FeedArgs {
  business: BusinessRow;
  events: FeedEventInput[];
  /** Override the calendar name shown in the user's calendar app. */
  feedName?: string;
}

/**
 * Build a multi-event ICS feed for a single business — the format vendors
 * subscribe to from Google Calendar / Apple Calendar / Outlook. Every
 * booking becomes a VEVENT inside one VCALENDAR.
 *
 * X-WR-CALNAME + REFRESH-INTERVAL hints tell calendar apps how to name
 * the feed and how often to poll. Most apps still poll on their own
 * cadence (Apple ~1h, Google ~12-24h), but setting these gives them
 * something to honour when available.
 */
export function buildIcsFeed({ business, events, feedName }: FeedArgs): string {
  const calName = feedName ?? `${business.name} — Bookit bookings`;
  const now = toIcsDateUtc(new Date().toISOString());

  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bookit//Vendor calendar feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calName)}`,
    `X-WR-CALDESC:${escapeText("All bookings for " + business.name + " — auto-updated by Bookit.")}`,
    // Hint to the client to refetch every hour (RFC 7986).
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  const eventBlocks = events.flatMap(({ booking, service, staff, start, end }) => {
    const summary = service
      ? `${service.name} · ${booking.customer_name}`
      : `Booking · ${booking.customer_name}`;

    const description = [
      `Customer: ${booking.customer_name}`,
      booking.customer_email ? `Email: ${booking.customer_email}` : null,
      booking.customer_phone ? `Phone: ${booking.customer_phone}` : null,
      `Reference: ${booking.booking_reference}`,
      service ? `Service: ${service.name}` : null,
      staff ? `Specialist: ${staff.name}` : null,
      booking.notes ? `Notes: ${booking.notes}` : null,
      booking.payment_amount != null && booking.payment_currency
        ? `Amount: ${booking.payment_amount} ${booking.payment_currency}`
        : null,
      `Status: ${booking.status}`,
    ]
      .filter(Boolean)
      .join("\\n");

    const location = [business.address, business.city, business.country]
      .filter(Boolean)
      .join(", ");

    // ICS STATUS field follows different vocab than our booking status.
    const icsStatus =
      booking.status === "cancelled"
        ? "CANCELLED"
        : booking.status === "completed"
          ? "CONFIRMED"
          : booking.status === "pending"
            ? "TENTATIVE"
            : "CONFIRMED";

    return [
      "BEGIN:VEVENT",
      `UID:${booking.id}@bk-it.ai`,
      `DTSTAMP:${now}`,
      `DTSTART:${toIcsDateUtc(start)}`,
      `DTEND:${toIcsDateUtc(end)}`,
      `SUMMARY:${escapeText(summary)}`,
      `DESCRIPTION:${escapeText(description)}`,
      location ? `LOCATION:${escapeText(location)}` : null,
      business.lat != null && business.lng != null
        ? `GEO:${business.lat};${business.lng}`
        : null,
      `STATUS:${icsStatus}`,
      "TRANSP:OPAQUE",
      "END:VEVENT",
    ].filter(Boolean) as string[];
  });

  return [...header, ...eventBlocks, "END:VCALENDAR"].join("\r\n");
}

/** Trigger a browser download of the full multi-event ICS feed. Useful
 *  as a one-off snapshot for vendors who don't want to subscribe. */
export function downloadIcsFeed(args: FeedArgs & { filename?: string }): void {
  const ics = buildIcsFeed(args);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const fn = args.filename ?? `${args.business.slug}-bookings-${stamp}.ics`;
  const a = document.createElement("a");
  a.href = url;
  a.download = fn;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
