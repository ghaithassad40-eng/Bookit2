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
  Printer,
  Receipt,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { BusinessRow, BusinessConfigRow } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PaymentBrandMark } from "@/components/customer/PaymentBrandMark";
import { LocationCard } from "@/components/customer/LocationCard";
import { getLocation } from "@/lib/location";
import { PAYMENT_METHODS, type PaymentMethodId } from "@/lib/payments";
import { getLocalBookings } from "@/lib/localBookings";
import { DEMO_SERVICES, DEMO_STAFF } from "@/lib/demoData";
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

  const booking = useMemo(
    () => (reference ? getLocalBookings().find((b) => b.booking_reference === reference) ?? null : null),
    [reference],
  );

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
            className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-emerald-500/15 text-emerald-500 ring-8 ring-emerald-500/5"
          >
            <CheckCircle2 className="h-10 w-10" />
          </motion.div>
          <Badge variant="success" className="mb-3 px-3 py-1 text-xs">
            Booking confirmed
          </Badge>
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            {config.copy_json.confirmationMessage}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We've emailed a copy of this invoice to you{booking?.customer_email ? ` at ${booking.customer_email}` : ""}.
          </p>
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
                  <dl className="space-y-2 text-sm">
                    <Line label="Subtotal" value={formatCurrency(amount, currency)} />
                    <Line label="Service charge" value={formatCurrency(0, currency)} subtle />
                    <Line label="Tax" value={formatCurrency(0, currency)} subtle />
                  </dl>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-sm font-medium">Total paid</span>
                    <span className="text-xl font-semibold tracking-tight">
                      {formatCurrency(amount, currency)}
                    </span>
                  </div>
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
              <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border/60 p-4">
                <Calendar className="mt-0.5 h-5 w-5 text-accent" />
                <div className="text-sm">
                  <div className="font-medium">Save the date</div>
                  <div className="text-muted-foreground">
                    Add this to your calendar so you don't miss it.
                  </div>
                </div>
              </div>
            </CardContent>

            <div className="flex flex-col gap-2 border-t border-border/60 bg-muted/30 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                Powered by Bookit
              </div>
              <div className="flex items-center gap-2" data-no-print>
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
