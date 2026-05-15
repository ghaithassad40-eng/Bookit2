import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  AlarmClock,
  Apple,
  Calendar as CalendarIcon,
  CalendarPlus,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Mail,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import type { BookingRow, BusinessRow, BusinessConfigRow } from "@/lib/database.types";
import { useBookings } from "@/hooks/useBookings";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { DEMO_SERVICES, DEMO_STAFF, generateDemoSlots } from "@/lib/demoData";
import { buildIcsFeed, downloadIcsFeed } from "@/lib/calendar";
import { formatDate, formatTime } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";

interface Ctx {
  business: BusinessRow;
  config: BusinessConfigRow;
}

/** Group bookings by ISO date (YYYY-MM-DD) so the upcoming list renders
 *  one section per day, sorted chronologically. */
function groupByDay(
  bookings: BookingRow[],
  startTimeFor: (b: BookingRow) => string | null,
): Map<string, Array<{ booking: BookingRow; start: string; end: string }>> {
  const map = new Map<
    string,
    Array<{ booking: BookingRow; start: string; end: string }>
  >();
  for (const b of bookings) {
    const start = startTimeFor(b);
    if (!start) continue;
    const service = DEMO_SERVICES.find((s) => s.id === b.service_id);
    const end = new Date(
      new Date(start).getTime() + (service?.duration_minutes ?? 60) * 60_000,
    ).toISOString();
    const day = start.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push({ booking: b, start, end });
  }
  // Sort each day's bookings by start time.
  for (const list of map.values()) {
    list.sort((a, b) => a.start.localeCompare(b.start));
  }
  return new Map([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

export default function CalendarPage() {
  const { business } = useOutletContext<Ctx>();
  const { t, intl } = useI18n();
  const intlLoc = intl(business.country);
  const { data: bookings, isLoading } = useBookings({
    businessId: business.id,
  });

  // Resolve start_time for every booking by reconstructing the slot grid.
  // In demo mode this is deterministic; in real Supabase mode this would
  // join through time_slots — the lookup pattern is the same either way.
  const slotIndex = useMemo(() => {
    return new Map(
      generateDemoSlots(business.id).map((s) => [s.id, s] as const),
    );
  }, [business.id]);

  function startTimeFor(b: BookingRow): string | null {
    return slotIndex.get(b.slot_id)?.start_time ?? null;
  }

  // Only future bookings show up in the calendar preview + the feed —
  // past + cancelled events stay in /admin/bookings.
  const upcoming = useMemo(() => {
    if (!bookings) return [] as BookingRow[];
    const nowIso = new Date().toISOString();
    return bookings.filter((b) => {
      if (b.status === "cancelled") return false;
      const start = startTimeFor(b);
      return start != null && start >= nowIso;
    });
  }, [bookings, slotIndex]);

  const grouped = useMemo(
    () => groupByDay(upcoming, startTimeFor),
    [upcoming, slotIndex],
  );

  // Build the public feed URL. Once the calendar-feed Edge Function is
  // deployed, this is the URL a vendor pastes into Google / Apple /
  // Outlook to subscribe. In demo mode the URL is informational — the
  // download below is what works today.
  const feedUrl = useMemo(() => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://bk-it.ai";
    return `${origin}/api/calendar/${business.slug}.ics`;
  }, [business.slug]);

  const [copied, setCopied] = useState(false);

  async function copyFeedUrl() {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      toast.success(t("admin.calendar.toast.copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("admin.calendar.toast.copyFailed"));
    }
  }

  function downloadNow() {
    const events = upcoming
      .map((b) => {
        const start = startTimeFor(b);
        if (!start) return null;
        const service = DEMO_SERVICES.find((s) => s.id === b.service_id) ?? null;
        const staff = b.staff_id
          ? DEMO_STAFF.find((s) => s.id === b.staff_id) ?? null
          : null;
        const end = new Date(
          new Date(start).getTime() + (service?.duration_minutes ?? 60) * 60_000,
        ).toISOString();
        return { booking: b, service, staff, start, end };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (events.length === 0) {
      toast.error(t("admin.calendar.toast.empty"));
      return;
    }
    downloadIcsFeed({ business, events });
    toast.success(
      t("admin.calendar.toast.downloaded").replace(
        "{{count}}",
        String(events.length),
      ),
    );
  }

  // Pre-built subscribe links for Google / Apple / Outlook. These deep-
  // link the vendor into the right add-calendar form on each platform.
  const googleSubscribeUrl = `https://calendar.google.com/calendar/u/0/r/settings/addbyurl?cid=${encodeURIComponent(
    feedUrl.replace(/^https?:\/\//, "webcal://"),
  )}`;
  const appleSubscribeUrl = feedUrl.replace(/^https?:\/\//, "webcal://");
  const outlookSubscribeUrl = `https://outlook.live.com/calendar/0/addfromweb/?url=${encodeURIComponent(
    feedUrl,
  )}&name=${encodeURIComponent(business.name + " — Bookit")}`;

  // Live ICS preview — handy for screenshots and for confirming the
  // feed parses cleanly before deploying.
  const previewIcs = useMemo(() => {
    if (upcoming.length === 0) return "";
    const events = upcoming
      .map((b) => {
        const start = startTimeFor(b);
        if (!start) return null;
        const service = DEMO_SERVICES.find((s) => s.id === b.service_id) ?? null;
        const staff = b.staff_id
          ? DEMO_STAFF.find((s) => s.id === b.staff_id) ?? null
          : null;
        const end = new Date(
          new Date(start).getTime() + (service?.duration_minutes ?? 60) * 60_000,
        ).toISOString();
        return { booking: b, service, staff, start, end };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .slice(0, 3);
    return buildIcsFeed({ business, events });
  }, [upcoming, business, slotIndex]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("admin.calendar.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("admin.calendar.subtitle")}
        </p>
      </header>

      {/* Sync card — feed URL + 3 subscribe options + download */}
      <Card>
        <CardHeader className="flex flex-row items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-navy/10 to-brand-gold/20 text-brand-gold">
            <CalendarPlus className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              {t("admin.calendar.sync.title")}
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <RefreshCw className="h-3 w-3" />
                {t("admin.calendar.sync.autoUpdate")}
              </Badge>
            </CardTitle>
            <CardDescription>{t("admin.calendar.sync.subtitle")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Feed URL row */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t("admin.calendar.sync.feedUrl")}
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-2">
              <code className="flex-1 truncate font-mono text-xs">{feedUrl}</code>
              <Button variant="outline" size="sm" onClick={copyFeedUrl}>
                {copied ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied
                  ? t("admin.calendar.sync.copied")
                  : t("admin.calendar.sync.copy")}
              </Button>
            </div>
          </div>

          {/* One-click subscribe buttons */}
          <div className="grid gap-2 sm:grid-cols-3">
            <SubscribeButton
              href={googleSubscribeUrl}
              icon={CalendarIcon}
              label="Google Calendar"
              tint="text-[#4285F4]"
            />
            <SubscribeButton
              href={appleSubscribeUrl}
              icon={Apple}
              label="Apple Calendar"
              tint="text-foreground"
            />
            <SubscribeButton
              href={outlookSubscribeUrl}
              icon={Mail}
              label="Outlook"
              tint="text-[#0078D4]"
            />
          </div>

          {/* Download as a snapshot — works offline / without subscribe support */}
          <div className="flex items-center justify-between rounded-xl border border-dashed border-border bg-muted/20 p-3">
            <div>
              <div className="text-sm font-medium">
                {t("admin.calendar.sync.downloadTitle")}
              </div>
              <div className="text-xs text-muted-foreground">
                {t("admin.calendar.sync.downloadHint")}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={downloadNow}>
              <Download className="h-3.5 w-3.5" />
              {t("admin.calendar.sync.download")}
            </Button>
          </div>

          {/* Caveat note — the feed URL only works in production */}
          <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200">
            {t("admin.calendar.sync.demoNote")}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming bookings — vendor's at-a-glance preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlarmClock className="h-4 w-4 text-muted-foreground" />
            {t("admin.calendar.upcoming.title")}
            <Badge variant="secondary" className="ms-auto text-xs">
              {upcoming.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : upcoming.length === 0 ? (
            <EmptyState
              title={t("admin.calendar.upcoming.emptyTitle")}
              description={t("admin.calendar.upcoming.emptyBody")}
            />
          ) : (
            <div className="space-y-5">
              {[...grouped.entries()].map(([day, items]) => {
                const dayLabel = formatDate(items[0].start, intlLoc);
                return (
                  <div key={day} className="space-y-2">
                    <div className="flex items-baseline justify-between border-b border-border pb-1.5">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {dayLabel}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {items.length}{" "}
                        {items.length === 1
                          ? t("admin.calendar.upcoming.bookingSingular")
                          : t("admin.calendar.upcoming.bookingPlural")}
                      </div>
                    </div>
                    <ul className="divide-y divide-border/60">
                      {items.map(({ booking, start }) => {
                        const service = DEMO_SERVICES.find(
                          (s) => s.id === booking.service_id,
                        );
                        const staff = booking.staff_id
                          ? DEMO_STAFF.find((s) => s.id === booking.staff_id)
                          : null;
                        return (
                          <li
                            key={booking.id}
                            className="flex items-start gap-3 py-2.5"
                          >
                            <div className="w-16 shrink-0 font-mono text-xs tabular-nums text-foreground/80">
                              {formatTime(start, intlLoc)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium">
                                {service?.name ?? "—"}
                                <span className="ms-1 font-normal text-muted-foreground">
                                  · {booking.customer_name}
                                </span>
                              </div>
                              <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                                <span className="font-mono">
                                  {booking.booking_reference}
                                </span>
                                {staff && <span>· {staff.name}</span>}
                                {booking.customer_phone && (
                                  <span>· {booking.customer_phone}</span>
                                )}
                              </div>
                            </div>
                            <Badge
                              variant={
                                booking.status === "confirmed"
                                  ? "default"
                                  : booking.status === "pending"
                                    ? "warning"
                                    : "secondary"
                              }
                              className="text-[9px] uppercase"
                            >
                              {booking.status}
                            </Badge>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Optional: ICS preview for dev / debugging */}
      {previewIcs && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              {t("admin.calendar.preview.title")}
            </CardTitle>
            <CardDescription className="text-xs">
              {t("admin.calendar.preview.subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-muted/30 p-3 font-mono text-[10px] leading-snug">
              {previewIcs}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SubscribeButton({
  href,
  icon: Icon,
  label,
  tint,
}: {
  href: string;
  icon: typeof CalendarIcon;
  label: string;
  tint: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-accent/40 hover:bg-muted/40"
    >
      <Icon className={`h-5 w-5 ${tint}`} />
      <span className="flex-1 text-sm font-medium">{label}</span>
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </a>
  );
}
