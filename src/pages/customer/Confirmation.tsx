import { useMemo, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Hash,
  Loader2,
  Printer,
  Receipt,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { BookingRow, BusinessRow, BusinessConfigRow } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PaymentBrandMark } from "@/components/customer/PaymentBrandMark";
import { LocationCard } from "@/components/customer/LocationCard";
import { getLocation } from "@/lib/location";
import { downloadIcs } from "@/lib/calendar";
import { PAYMENT_METHODS, type PaymentMethodId } from "@/lib/payments";
import { getLocalBookings } from "@/lib/localBookings";
import { DEMO_SERVICES, DEMO_STAFF, generateDemoSlots } from "@/lib/demoData";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { useCancelBooking } from "@/hooks/useBookings";
import { useI18n } from "@/hooks/useI18n";
import { formatCurrency, formatDate, formatTime, initials } from "@/lib/utils";
import { toast } from "sonner";

interface Ctx {
  business: BusinessRow;
  config: BusinessConfigRow;
}

export default function Confirmation() {
  const { business, config } = useOutletContext<Ctx>();
  const [params] = useSearchParams();
  const reference = params.get("ref");
  const [copied, setCopied] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  // Locally overlay the booking status so the UI updates instantly after a
  // successful cancel, without having to refetch from localStorage.
  const [overlay, setOverlay] = useState<Partial<BookingRow> | null>(null);
  const { format: formatDisplay } = useDisplayCurrency();
  const { t } = useI18n();
  const cancelMutation = useCancelBooking();

  const baseBooking = useMemo(
    () => (reference ? getLocalBookings().find((b) => b.booking_reference === reference) ?? null : null),
    [reference],
  );
  const booking = baseBooking ? ({ ...baseBooking, ...overlay } as BookingRow) : null;

  const isCancelled = booking?.status === "cancelled";
  const canCancel = booking && !isCancelled;

  // Resolve service + staff for receipt context (works in demo + when row is local).
  const service = useMemo(
    () => DEMO_SERVICES.find((s) => s.id === booking?.service_id) ?? null,
    [booking],
  );
  const staff = useMemo(
    () => (booking?.staff_id ? DEMO_STAFF.find((s) => s.id === booking.staff_id) ?? null : null),
    [booking],
  );

  const paid =
    booking?.payment_status === "paid" || booking?.payment_status === null || !!booking?.payment_transaction_id;
  const method = booking?.payment_method as PaymentMethodId | null | undefined;
  const amount = booking?.payment_amount ?? service?.price ?? null;
  const currency = booking?.payment_currency ?? service?.currency ?? "USD";

  const issuedAt = booking?.created_at ? new Date(booking.created_at) : new Date();
  const invoiceNumber = useMemo(() => {
    if (!reference) return "—";
    return `INV-${reference.replace(/^BK-/, "")}`;
  }, [reference]);

  // Resolve the slot's start/end times for the .ics download. In demo mode we
  // regenerate the deterministic slot grid and match by id; in production this
  // would be a JOIN against time_slots.
  const slotTimes = useMemo(() => {
    if (!booking?.business_id || !booking.slot_id) return null;
    const slot = generateDemoSlots(booking.business_id).find((s) => s.id === booking.slot_id);
    return slot ? { start: slot.start_time, end: slot.end_time } : null;
  }, [booking?.business_id, booking?.slot_id]);

  function handleAddToCalendar() {
    if (!booking || !slotTimes) {
      toast.error("Couldn't find the slot times to build the calendar event");
      return;
    }
    downloadIcs({
      booking,
      business,
      service,
      staff,
      start: slotTimes.start,
      end: slotTimes.end,
    });
  }

  function handleCopy() {
    if (!reference) return;
    void navigator.clipboard?.writeText(reference);
    setCopied(true);
    toast.success("Reference copied");
    setTimeout(() => setCopied(false), 2000);
  }

  function handlePrint() {
    window.print();
  }

  async function handleCancel() {
    if (!booking) return;
    try {
      const result = await cancelMutation.mutateAsync({
        id: booking.id,
        business_id: booking.business_id,
      });
      setOverlay({
        status: result.booking.status,
        payment_status: result.booking.payment_status,
        payout_status: result.booking.payout_status,
      });
      setCancelOpen(false);
      toast.success(result.refunded ? t("booking.refundIssued") : t("booking.cancelled"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("booking.cancelFailed"));
    }
  }

  return (
    <>
      <style>{`
        @media print {
          body { background: white !important; }
          header, footer, nav, [data-no-print] { display: none !important; }
          .invoice-card { box-shadow: none !important; border: 1px solid #e5e7eb !important; }
        }
      `}</style>

      <div className="container max-w-3xl py-10 sm:py-16">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 16, stiffness: 220, delay: 0.1 }}
            className={
              isCancelled
                ? "mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-rose-500/15 text-rose-500 ring-8 ring-rose-500/5"
                : "mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-emerald-500/15 text-emerald-500 ring-8 ring-emerald-500/5"
            }
          >
            {isCancelled ? <XCircle className="h-10 w-10" /> : <CheckCircle2 className="h-10 w-10" />}
          </motion.div>
          {isCancelled ? (
            <>
              <Badge variant="destructive" className="mb-3 px-3 py-1 text-xs">
                {t("booking.cancelled")}
              </Badge>
              <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                {booking?.payment_status === "refunded"
                  ? t("booking.refundIssued")
                  : t("booking.cancelled")}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {booking?.payment_status === "refunded"
                  ? t("booking.refundIssuedBody")
                  : t("booking.cancelledBody")}
              </p>
            </>
          ) : (
            <>
              <Badge variant="success" className="mb-3 px-3 py-1 text-xs">
                Booking confirmed
              </Badge>
              <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                {config.copy_json.confirmationMessage}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We've emailed a copy of this invoice to you{booking?.customer_email ? ` at ${booking.customer_email}` : ""}.
              </p>
            </>
          )}
        </motion.div>

        {/* Invoice card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="invoice-card overflow-hidden">
            {/* Header band */}
            <div className="flex flex-col gap-3 border-b border-border/60 bg-gradient-to-br from-card to-muted/30 p-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-3">
                {business.logo_url ? (
                  <img src={business.logo_url} alt={business.name} className="h-12 w-12 rounded-xl object-cover" />
                ) : (
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-accent/15 text-base font-bold text-accent">
                    {initials(business.name)}
                  </div>
                )}
                <div>
                  <div className="text-base font-semibold leading-tight">{business.name}</div>
                  <div className="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground">
                    {business.industry}
                  </div>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Receipt className="h-3 w-3" /> Invoice
                </div>
                <div className="mt-1.5 font-mono text-sm font-semibold">{invoiceNumber}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Issued {formatDate(issuedAt.toISOString())} · {formatTime(issuedAt.toISOString())}
                </div>
              </div>
            </div>

            <CardContent className="space-y-6 p-6">
              {/* Reference */}
              <div className="flex flex-col items-start justify-between gap-3 rounded-2xl bg-muted/30 p-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2.5 text-sm">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Booking reference</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-semibold">{reference ?? "—"}</span>
                  <button
                    onClick={handleCopy}
                    aria-label="Copy reference"
                    className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 bg-card transition-colors hover:bg-muted"
                  >
                    {copied ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>

              {/* Booking details */}
              <section>
                <SectionHeader>Booking details</SectionHeader>
                <dl className="divide-y divide-border/60">
                  <Row label="Service" value={service?.name ?? "—"} />
                  {staff && <Row label="Specialist" value={staff.name} />}
                  {service && <Row label="Duration" value={`${service.duration_minutes} minutes`} />}
                  {booking?.notes && <Row label="Notes" value={booking.notes} />}
                </dl>
              </section>

              {/* Customer */}
              {booking && (
                <section>
                  <SectionHeader>Billed to</SectionHeader>
                  <dl className="divide-y divide-border/60">
                    <Row label="Name" value={booking.customer_name} />
                    {booking.customer_email && <Row label="Email" value={booking.customer_email} />}
                    {booking.customer_phone && <Row label="Phone" value={booking.customer_phone} />}
                  </dl>
                </section>
              )}

              {/* Charges */}
              {amount != null && (
                <section className="rounded-2xl border border-border/60 bg-card/50 p-5">
                  <SectionHeader className="mb-3">Charges</SectionHeader>
                  {(() => {
                    const charge = formatDisplay(amount!, currency);
                    return (
                      <>
                        <dl className="space-y-2 text-sm">
                          <Line label="Subtotal" value={charge.display} />
                          <Line label="Service charge" value={formatCurrency(0, charge.displayCurrency)} subtle />
                          <Line label="Tax" value={formatCurrency(0, charge.displayCurrency)} subtle />
                        </dl>
                        <div className="mt-3 flex items-start justify-between border-t border-border pt-3">
                          <span className="text-sm font-medium">Total paid</span>
                          <span className="text-right">
                            <span className="block text-xl font-semibold tracking-tight">{charge.display}</span>
                            {charge.converted && (
                              <span className="mt-0.5 block text-[11px] font-mono text-muted-foreground">
                                Settled as {charge.native}
                              </span>
                            )}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </section>
              )}

              {/* Payment */}
              {method && (
                <section>
                  <SectionHeader>Payment</SectionHeader>
                  <div className="mt-2 flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card/50 p-4">
                    <div className="flex items-center gap-3">
                      <PaymentBrandMark method={method} />
                      <div>
                        <div className="text-sm font-medium">
                          {PAYMENT_METHODS[method]?.shortLabel ?? method}
                          {booking?.payment_transaction_id && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                              <ShieldCheck className="h-3 w-3" />
                              {paid ? "Paid" : "Pending"}
                            </span>
                          )}
                        </div>
                        {booking?.payment_transaction_id && (
                          <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                            Txn {booking.payment_transaction_id}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* Calendar nudge */}
              <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Calendar className="mt-0.5 h-5 w-5 text-accent" />
                  <div className="text-sm">
                    <div className="font-medium">Save the date</div>
                    <div className="text-muted-foreground">
                      Add this to your calendar so you don't miss it.
                    </div>
                  </div>
                </div>
                {slotTimes && (
                  <Button variant="outline" size="sm" onClick={handleAddToCalendar} data-no-print>
                    <Calendar className="h-3.5 w-3.5" />
                    Add to calendar
                  </Button>
                )}
              </div>

              {/* Escrow protection note */}
              {paid && (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                  <div className="text-sm">
                    <div className="font-medium text-emerald-700 dark:text-emerald-200">
                      Your payment is protected by escrow
                    </div>
                    <div className="mt-0.5 text-xs text-emerald-700/70 dark:text-emerald-200/70">
                      Funds are held with the platform until your service is delivered.
                      If something goes wrong before then, the refund returns to you cleanly —
                      we haven't released the money to {business.name} yet.
                    </div>
                  </div>
                </div>
              )}
            </CardContent>

            <div className="flex flex-col gap-2 border-t border-border/60 bg-muted/30 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                Powered by Bookit
              </div>
              <div className="flex flex-wrap items-center gap-2" data-no-print>
                {canCancel && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCancelOpen(true)}
                    className="border-rose-500/30 text-rose-600 hover:bg-rose-500/5 dark:text-rose-300"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    {t("booking.cancel")}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-3.5 w-3.5" /> Print invoice
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Where to go */}
        {getLocation(business) && (
          <div className="mt-6" data-no-print>
            <LocationCard business={business} compact />
          </div>
        )}

        {/* Footer CTAs */}
        <div className="mt-8 flex flex-col items-stretch justify-center gap-2 sm:flex-row" data-no-print>
          <Button asChild>
            <Link to={`/business/${business.slug}`}>
              Back to {business.name}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/business/${business.slug}/book`}>
              <Clock className="h-4 w-4" />
              Book another
            </Link>
          </Button>
        </div>
      </div>

      {/* Cancel confirmation dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-rose-500/15 text-rose-500">
              <XCircle className="h-5 w-5" />
            </div>
            <DialogTitle>{t("booking.cancelConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("booking.cancelConfirmBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={cancelMutation.isPending}>
                {t("booking.cancelKeep")}
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("booking.cancelling")}
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  {t("booking.cancelConfirm")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SectionHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground ${className}`}>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm first:pt-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function Line({ label, value, subtle }: { label: string; value: string; subtle?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-sm ${subtle ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
