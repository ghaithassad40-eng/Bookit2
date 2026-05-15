// Supabase Edge Function: calendar-feed
//
// Serves a multi-event ICS calendar feed for one business. The vendor
// subscribes their calendar app (Google / Apple / Outlook) to:
//
//   https://bk-it.ai/api/calendar/<business-slug>.ics
//
// which is rewritten (via Vercel / Cloudflare in front of Supabase, or
// directly when this function is reachable as
// /functions/v1/calendar-feed?slug=<slug>) to invoke this function.
//
// The function:
//   1. Looks up the business by slug + verifies it's `approved`.
//   2. Fetches upcoming non-cancelled bookings joined to the time_slots
//      table for start/end times, plus services + staff for labels.
//   3. Emits a VCALENDAR with one VEVENT per booking, including X-WR-CALNAME,
//      X-PUBLISHED-TTL, REFRESH-INTERVAL so calendar apps know how often
//      to poll.
//   4. Returns Content-Type: text/calendar.
//
// Auth model:
//   The feed URL embeds the business slug (public) — anyone with the URL
//   can subscribe. That's the same trust model Google Calendar and Apple
//   Calendar use for "secret iCal URLs". For production hardening
//   (preventing scraping), append a per-vendor opaque token to the URL:
//     /calendar/<slug>.ics?token=<random-32-bytes>
//   and store the token on the business row. Vendor rotates via the
//   admin UI if a URL leaks. The current build leaves the auth gate open
//   so the demo works without a backend round-trip — see SECURITY.md
//   production checklist item #11.
//
// Env (Supabase function secrets):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function toIcsDateUtc(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") {
    return new Response("method not allowed", { status: 405, headers: corsHeaders });
  }

  const url = new URL(req.url);
  // Accept either /calendar-feed?slug=foo or /calendar-feed/foo.ics
  const slugParam = url.searchParams.get("slug");
  const pathSlug = url.pathname.split("/").pop()?.replace(/\.ics$/, "") ?? null;
  const slug = slugParam ?? pathSlug;
  if (!slug || slug === "calendar-feed") {
    return new Response("missing slug", { status: 400, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    return new Response("supabase env not set", { status: 503, headers: corsHeaders });
  }
  const supa = createClient(supabaseUrl, serviceKey);

  // 1. Resolve business
  const { data: businesses, error: bErr } = await supa
    .from("businesses")
    .select("*")
    .eq("slug", slug)
    .eq("status", "approved")
    .limit(1);
  if (bErr) {
    return new Response("db error", { status: 500, headers: corsHeaders });
  }
  const business = businesses?.[0];
  if (!business) {
    return new Response("business not found", { status: 404, headers: corsHeaders });
  }

  // 2. Fetch upcoming non-cancelled bookings with their slot start/end
  //    and the service for a readable summary line.
  const nowIso = new Date().toISOString();
  const { data: bookings, error: bookErr } = await supa
    .from("bookings")
    .select(
      "id, business_id, service_id, staff_id, slot_id, customer_name, customer_email, customer_phone, notes, booking_reference, status, payment_amount, payment_currency, time_slots!inner(start_time, end_time), services(name, duration_minutes), staff(name)",
    )
    .eq("business_id", business.id)
    .neq("status", "cancelled")
    .gte("time_slots.start_time", nowIso)
    .order("time_slots(start_time)", { ascending: true })
    .limit(500);

  if (bookErr) {
    return new Response("db error", { status: 500, headers: corsHeaders });
  }

  const now = toIcsDateUtc(new Date().toISOString());
  const calName = `${business.name} — Bookit bookings`;

  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bookit//Vendor calendar feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(calName)}`,
    `X-WR-CALDESC:${escapeIcs(`All bookings for ${business.name} — auto-updated by Bookit.`)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  const events: string[] = [];
  for (const b of bookings ?? []) {
    const slot = (b.time_slots as unknown) as { start_time: string; end_time: string } | null;
    if (!slot) continue;
    const service = (b.services as unknown) as { name: string } | null;
    const staff = (b.staff as unknown) as { name: string } | null;

    const summary = service
      ? `${service.name} · ${b.customer_name}`
      : `Booking · ${b.customer_name}`;

    const description = [
      `Customer: ${b.customer_name}`,
      b.customer_email ? `Email: ${b.customer_email}` : null,
      b.customer_phone ? `Phone: ${b.customer_phone}` : null,
      `Reference: ${b.booking_reference}`,
      service ? `Service: ${service.name}` : null,
      staff ? `Specialist: ${staff.name}` : null,
      b.notes ? `Notes: ${b.notes}` : null,
      b.payment_amount != null && b.payment_currency
        ? `Amount: ${b.payment_amount} ${b.payment_currency}`
        : null,
      `Status: ${b.status}`,
    ]
      .filter(Boolean)
      .join("\\n");

    const location = [business.address, business.city, business.country]
      .filter(Boolean)
      .join(", ");

    const icsStatus =
      b.status === "completed"
        ? "CONFIRMED"
        : b.status === "pending"
          ? "TENTATIVE"
          : "CONFIRMED";

    events.push(
      "BEGIN:VEVENT",
      `UID:${b.id}@bk-it.ai`,
      `DTSTAMP:${now}`,
      `DTSTART:${toIcsDateUtc(slot.start_time)}`,
      `DTEND:${toIcsDateUtc(slot.end_time)}`,
      `SUMMARY:${escapeIcs(summary)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
    );
    if (location) events.push(`LOCATION:${escapeIcs(location)}`);
    if (business.lat != null && business.lng != null) {
      events.push(`GEO:${business.lat};${business.lng}`);
    }
    events.push(`STATUS:${icsStatus}`, "TRANSP:OPAQUE", "END:VEVENT");
  }

  const ics = [...header, ...events, "END:VCALENDAR"].join("\r\n");

  return new Response(ics, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${slug}-bookings.ics"`,
      // Light caching — calendar apps poll on their own cadence anyway,
      // and we want updates to propagate within a few minutes.
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
});
