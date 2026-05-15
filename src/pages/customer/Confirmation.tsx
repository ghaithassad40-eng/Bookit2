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
import { ReviewForm } from "@/components/customer/ReviewForm";
import { getLocation } from "@/lib/location";
import { downloadIcs } from "@/lib/calendar";
import { PAYMENT_METHODS, type PaymentMethodId } from "@/lib/payments";
import { getLocalBookings } from "@/lib/localBookings";
import { getLocalBookingEquipment } from "@/lib/localBookingEquipment";
import {
  DEMO_EQUIPMENT,
  DEMO_SERVICES,
  DEMO_STAFF,
  generateDemoSlots,
} from "@/lib/demoData";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { useCancelBooking } from "@/hooks/useBookings";
import { useI18n } from "@/hooks/useI18n";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { pickLocale } from "@/lib/i18n";
import { ShieldAlert } from "lucide-react";
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
  const { t, locale } = useI18n();
  const { customer: authedCustomer } = useCustomerAuth();
  const cancelMutation = useCancelBooking();

  const baseBooking = useMemo(
    () => (reference ? getLocalBookings().find((b) => b.booking_reference === reference) ?? null : null),
    [reference],
  );
  const booking = baseBooking ? ({ ...baseBooking, ...overlay } as BookingRow) : null;

  const isCancelled = booking?.status === "cancelled";
  // Ownership gate — block the IDOR where anyone with a booking reference
  // could view the victim's PII *and* trigger cancel/refund. A booking is
  // 'yours' if you're signed in with the same email it was made under (or
  // the booking pre-dates customer auth and has no email — legacy demo
  // rows). If the customer isn't signed in or the email doesn't match, we
  // refuse to show the page.
  const bookingEmail = booking?.customer_email?.toLowerCase() ?? null;
  const authEmail = authedCustomer?.email?.toLowerCase() ?? null;
  const isOwner =
    booking !== null &&
    (bookingEmail === null || (authEmail !== null && bookingEmail === authEmail));
  const canCancel = booking && !isCancelled && isOwner;

  // Resolve service + staff for receipt context (works in demo + when row is local).
  const service = useMemo(
    () => DEMO_SERVICES.find((s) => s.id === booking?.service_id) ?? null,
    [booking],
  );
  const staff = useMemo(
    () => (booking?.staff_id ? DEMO_STAFF.find((s) => s.id === booking.staff_id) ?? null : null),
    [booking],
  );

  // Equipment line items selected at booking time, resolved against the
  // canonical equipment catalog so we can render the (translated) name even
  // if the source row was deactivated since.
  const equipmentLines = useMemo(() => {
    if (!booking) return [] as Array<{
      id: string;
      name: string;
      name_ar: string | null;
      quantity: number;
      unit_price: number;
      currency: string;
      is_free: boolean;
    }>;
    return getLocalBookingEquipment(booking.id).map((row) => {
      const eq = DEMO_EQUIPMENT.find((e) => e.id === row.equipment_id);
      return {
        id: row.id,
        name: eq?.name ?? row.equipment_id,
        name_ar: eq?.name_ar ?? null,
        quantity: row.quantity,
        unit_price: row.unit_price,
        currency: row.currency,
        is_free: row.unit_price === 0 && eq?.price == null,
      };
    });
  }, [booking]);
  const equipmentSubtotal = equipmentLines.reduce(
    (sum, l) => sum + (l.is_free ? 0 : l.unit_price * l.quantity),
    0,
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
      toast.error(t("invoice.calendarError"));
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
    toast.success(t("invoice.referenceCopied"));
    setTimeout(() => setCopied(false), 2000);
  }

  function handlePrint() {
    window.print();
  }

  async function handleCancel() {
    if (!booking) return;
    if (!isOwner) {
      // Defensive: the cancel button is hidden when !isOwner, but if a caller
      // races state we still refuse — never let a non-owner trigger a refund.
      toast.error(t("owner.notYours.title"));
      return;
    }
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

  // Ownership gate — if the booking exists but the caller isn't the owner,
  // refuse to render the receipt (which leaks customer_name / email / phone)
  // and refuse to expose cancel + review actions. The gate fires only when a
  // booking was actually resolved by reference; missing references still
  // fall through to the normal "—" placeholders below.
  if (reference && booking && !isOwner) {
    return (
      <div className="container max-w-md py-16 sm:py-24">
        <div className="rounded-2xl border border-border/60 bg-card/60 p-8 text-center backdrop-blur-sm">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-rose-500/15 text-rose-500">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-balance text-xl font-semibold tracking-tight">
            {t("owner.notYours.title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("owner.notYours.body")}
          </p>
          <div className="mt-6 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link to={`/business/${business.slug}/book`}>
                {t("owner.notYours.signIn")}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">
                {t("owner.notYours.browse")}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
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
                {t("invoice.bookingConfirmed")}
              </Badge>
              <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                {config.copy_json.confirmationMessage}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("invoice.emailedCopy")}
                {booking?.customer_email ? ` ${t("invoice.emailedCopyAt")} ${booking.customer_email}` : ""}.
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
              <div className="text-start sm:text-end">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Receipt className="h-3 w-3" /> {t("invoice.invoice")}
                </div>
                <div className="mt-1.5 font-mono text-sm font-semibold">{invoiceNumber}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {t("invoice.issued")} {formatDate(issuedAt.toISOString())} · {formatTime(issuedAt.toISOString())}
                </div>
              </div>
            </div>

            <CardContent className="space-y-6 p-6">
              {/* Reference */}
              <div className="flex flex-col items-start justify-between gap-3 rounded-2xl bg-muted/30 p-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2.5 text-sm">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{t("invoice.bookingReference")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-semibold">{reference ?? "—"}</span>
                  <button
                    onClick={handleCopy}
                    aria-label={t("invoice.copyReference")}
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
                <SectionHeader>{t("invoice.bookingDetails")}</SectionHeader>
                <dl className="divide-y divide-border/60">
                  <Row
                    label={t("invoice.service")}
                    value={service ? pickLocale(locale, service.name, service.name_ar) : "—"}
                  />
                  {staff && <Row label={t("invoice.specialist")} value={staff.name} />}
                  {service && (
                    <Row
                      label={t("invoice.duration")}
                      value={`${service.duration_minutes} ${t("invoice.minutes")}`}
                    />
                  )}
                  {booking?.notes && <Row label={t("invoice.notes")} value={booking.notes} />}
                </dl>
              </section>

              {/* Customer */}
              {booking && (
                <section>
                  <SectionHeader>{t("invoice.billedTo")}</SectionHeader>
                  <dl className="divide-y divide-border/60">
                    <Row label={t("invoice.name")} value={booking.customer_name} />
                    {booking.customer_email && <Row label={t("invoice.email")} value={booking.customer_email} />}
                    {booking.customer_phone && <Row label={t("invoice.phone")} value={booking.customer_phone} />}
                  </dl>
                </section>
              )}

              {/* Equipment add-ons */}
              {equipmentLines.length > 0 && (
                <section>
                  <SectionHeader>{t("invoice.equipment")}</SectionHeader>
                  <dl className="divide-y divide-border/60">
                    {equipmentLines.map((line) => (
                      <Row
                        key={line.id}
                        label={`${line.quantity}× ${pickLocale(locale, line.name, line.name_ar)}`}
                        value={
                          line.is_free
                            ? t("invoice.equipmentIncluded")
                            : formatDisplay(line.unit_price * line.quantity, line.currency).display
                        }
                      />
                    ))}
                  </dl>
                </section>
              )}

              {/* Charges */}
              {amount != null && (
                <section className="rounded-2xl border border-border/60 bg-card/50 p-5">
                  <SectionHeader className="mb-3">{t("invoice.charges")}</SectionHeader>
                  {(() => {
                    const serviceAmount = amount! - equipmentSubtotal;
                    const charge = formatDisplay(amount!, currency);
                    const serviceLine = formatDisplay(serviceAmount, currency);
                    const equipmentLine = formatDisplay(equipmentSubtotal, currency);
                    return (
                      <>
                        <dl className="space-y-2 text-sm">
                          <Line label={t("invoice.subtotal")} value={serviceLine.display} />
                          {equipmentSubtotal > 0 && (
                            <Line
                              label={t("invoice.equipmentSubtotal")}
                              value={equipmentLine.display}
                            />
                          )}
                          <Line label={t("invoice.serviceCharge")} value={formatCurrency(0, charge.displayCurrency)} subtle />
                          <Line label={t("invoice.tax")} value={formatCurrency(0, charge.displayCurrency)} subtle />
                        </dl>
                        <div className="mt-3 flex items-start justify-between border-t border-border pt-3">
                          <span className="text-sm font-medium">{t("invoice.totalPaid")}</span>
                          <span className="text-end">
                            <span className="block text-xl font-semibold tracking-tight">{charge.display}</span>
                            {charge.converted && (
                              <span className="mt-0.5 block text-[11px] font-mono text-muted-foreground">
                                {t("invoice.settledAs")} {charge.native}
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
                  <SectionHeader>{t("invoice.payment")}</SectionHeader>
                  <div className="mt-2 flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card/50 p-4">
                    <div className="flex items-center gap-3">
                      <PaymentBrandMark method={method} />
                      <div>
                        <div className="text-sm font-medium">
                          {PAYMENT_METHODS[method]?.shortLabel ?? method}
                          {booking?.payment_transaction_id && (
                            <span className="ms-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                              <ShieldCheck className="h-3 w-3" />
                              {paid ? t("invoice.paid") : t("invoice.pending")}
                            </span>
                          )}
                        </div>
                        {booking?.payment_transaction_id && (
                          <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                            {t("invoice.txn")} {booking.payment_transaction_id}
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
                    <div className="font-medium">{t("invoice.saveTheDate")}</div>
                    <div className="text-muted-foreground">
                      {t("invoice.saveTheDateBody")}
                    </div>
                  </div>
                </div>
                {slotTimes && (
                  <Button variant="outline" size="sm" onClick={handleAddToCalendar} data-no-print>
                    <Calendar className="h-3.5 w-3.5" />
                    {t("invoice.addToCalendar")}
                  </Button>
                )}
              </div>

              {/* Escrow protection note */}
              {paid && (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                  <div className="text-sm">
                    <div className="font-medium text-emerald-700 dark:text-emerald-200">
                      {t("invoice.escrowTitle")}
                    </div>
                    <div className="mt-0.5 text-xs text-emerald-700/70 dark:text-emerald-200/70">
                      {t("invoice.escrowBody").replace(
                        "{{business}}",
                        pickLocale(locale, business.name, business.name_ar),
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>

            <div className="flex flex-col gap-2 border-t border-border/60 bg-muted/30 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                {t("invoice.poweredBy")}
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
                  <Printer className="h-3.5 w-3.5" /> {t("invoice.print")}
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Review form — visible whenever there's a booking, until the
            customer cancels (we don't want to ask for a review on a
            cancelled booking). */}
        {booking && !isCancelled && (
          <div className="mt-6" data-no-print>
            <ReviewForm
              businessId={business.id}
              bookingReference={booking.booking_reference}
              customerName={booking.customer_name}
            />
          </div>
        )}

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
              {t("invoice.backTo")} {pickLocale(locale, business.name, business.name_ar)}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/business/${business.slug}/book`}>
              <Clock className="h-4 w-4" />
              {t("invoice.bookAnother")}
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
