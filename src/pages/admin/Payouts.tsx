import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Banknote,
  CheckCircle2,
  Clock,
  Percent,
  RefreshCw,
  Receipt,
  ShieldCheck,
  AlertTriangle,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import type {
  BookingRow,
  BusinessRow,
  BusinessConfigRow,
  PayoutRow,
  PayoutStatus,
} from "@/lib/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty";
import { useBookings } from "@/hooks/useBookings";
import { usePayouts, useReleasePayout } from "@/hooks/usePayouts";
import { calculateSplit, summarisePayouts } from "@/lib/escrow";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";

interface Ctx {
  business: BusinessRow;
  config: BusinessConfigRow;
}

const STATUS_VARIANT: Record<PayoutStatus, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  pending_transfer: "warning",
  transferred: "success",
  transfer_failed: "destructive",
  reversed: "secondary",
};

const STATUS_LABEL: Record<PayoutStatus, string> = {
  pending_transfer: "Releasing",
  transferred: "Paid out",
  transfer_failed: "Failed",
  reversed: "Reversed",
};

export default function Payouts() {
  const { business } = useOutletContext<Ctx>();
  const { data: bookings, isLoading: loadingBookings } = useBookings({ businessId: business.id });
  const { data: payouts, isLoading: loadingPayouts } = usePayouts(business.id);
  const release = useReleasePayout();
  const [filter, setFilter] = useState<"all" | "held" | PayoutStatus>("all");

  const summary = useMemo(
    () => summarisePayouts(bookings ?? [], payouts ?? [], business.id),
    [bookings, payouts, business.id],
  );

  const heldBookings: BookingRow[] = useMemo(
    () =>
      (bookings ?? []).filter(
        (b) => b.payout_status === "held" && b.payment_status === "paid",
      ),
    [bookings],
  );

  const rows = useMemo(() => {
    const allPayouts = payouts ?? [];
    if (filter === "all") {
      const held = heldBookings.map((b) => ({ kind: "held" as const, booking: b }));
      const done = allPayouts.map((p) => ({ kind: "payout" as const, payout: p }));
      return [...held, ...done].sort((a, b) => {
        const dateA = a.kind === "held" ? a.booking.created_at : a.payout.created_at;
        const dateB = b.kind === "held" ? b.booking.created_at : b.payout.created_at;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
    }
    if (filter === "held") {
      return heldBookings.map((b) => ({ kind: "held" as const, booking: b }));
    }
    return allPayouts
      .filter((p) => p.status === filter)
      .map((p) => ({ kind: "payout" as const, payout: p }));
  }, [filter, payouts, heldBookings]);

  const loading = loadingBookings || loadingPayouts;
  const currency = summary.currency;
  const commissionPct = (business.commission_bps / 100).toFixed(business.commission_bps % 100 === 0 ? 0 : 2);

  async function releaseManually(booking: BookingRow) {
    try {
      await release.mutateAsync({
        booking,
        business,
        reason: "manual_override",
        actor: `manual:admin`,
      });
      toast.success("Released — payout queued for transfer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Release failed");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payouts &amp; Escrow</h1>
          <p className="text-sm text-muted-foreground">
            Every customer payment is held in escrow, then split — commission to the platform, the rest to you.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs">
          <Percent className="h-3.5 w-3.5 text-accent" />
          <span className="font-medium">Commission</span>
          <span className="font-mono">{commissionPct}%</span>
        </div>
      </header>

      {/* KPI tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Held in escrow"
          value={formatCurrency(summary.heldAmount, currency)}
          sub={`${summary.heldCount} booking${summary.heldCount === 1 ? "" : "s"}`}
          icon={Clock}
          accent="warning"
          loading={loading}
        />
        <Tile
          label="Paid out to you"
          value={formatCurrency(summary.merchantPayouts, currency)}
          sub={`${summary.releasedCount} payout${summary.releasedCount === 1 ? "" : "s"}`}
          icon={Wallet}
          accent="success"
          loading={loading}
        />
        <Tile
          label="Platform fees collected"
          value={formatCurrency(summary.platformRevenue, currency)}
          sub={`${commissionPct}% commission`}
          icon={Banknote}
          accent="default"
          loading={loading}
        />
        <Tile
          label="Failed transfers"
          value={summary.failed.toString()}
          sub={summary.failed > 0 ? "Needs ops attention" : "Clean — all delivered"}
          icon={AlertTriangle}
          accent={summary.failed > 0 ? "destructive" : "default"}
          loading={loading}
        />
      </div>

      {/* Escrow status banner */}
      <div className="flex flex-col gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 text-sm">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <div>
            <div className="font-medium text-emerald-700 dark:text-emerald-200">
              Payouts {business.payouts_enabled ? "enabled" : "not enabled"} ·{" "}
              {business.payout_provider}
            </div>
            <div className="mt-0.5 text-xs text-emerald-700/70 dark:text-emerald-200/70">
              {business.payouts_enabled
                ? business.iban_last4
                  ? `Settling to IBAN ending in ${business.iban_last4} the same day funds clear.`
                  : "Connected — your share lands in your bank the same day funds clear."
                : "Complete KYC in Settings to start receiving payouts."}
            </div>
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground sm:text-right">
          Account ID
          <div className="mt-0.5 font-mono">
            {business.connected_account_id ?? "—"}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card/40 p-1">
        {(
          [
            ["all", "All"],
            ["held", "Held in escrow"],
            ["pending_transfer", "Releasing"],
            ["transferred", "Paid out"],
            ["transfer_failed", "Failed"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === k
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{rows.length} record{rows.length === 1 ? "" : "s"}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="No payouts yet"
              description="Once a customer pays an invoice, it'll land here as Held — then release automatically after the service window."
              icon={<Receipt className="h-5 w-5" />}
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Reference</th>
                    <th className="px-4 py-3 text-left hidden sm:table-cell">When</th>
                    <th className="px-4 py-3 text-right">Gross</th>
                    <th className="px-4 py-3 text-right hidden sm:table-cell">Fee</th>
                    <th className="px-4 py-3 text-right">Your share</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) =>
                    row.kind === "held" ? (
                      <HeldRow
                        key={`held-${row.booking.id}`}
                        booking={row.booking}
                        commissionBps={business.commission_bps}
                        onRelease={() => releaseManually(row.booking)}
                        releasing={release.isPending}
                      />
                    ) : (
                      <PayoutRowEl key={row.payout.id} payout={row.payout} />
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HeldRow({
  booking,
  commissionBps,
  onRelease,
  releasing,
}: {
  booking: BookingRow;
  commissionBps: number;
  onRelease: () => void;
  releasing: boolean;
}) {
  const split = calculateSplit(
    booking.payment_amount ?? 0,
    booking.payment_currency ?? "USD",
    commissionBps,
  );
  return (
    <tr className="border-t border-border/50 align-middle">
      <td className="px-4 py-3">
        <div className="font-mono text-xs">{booking.booking_reference}</div>
        <div className="text-[11px] text-muted-foreground">{booking.customer_name}</div>
      </td>
      <td className="hidden sm:table-cell px-4 py-3 text-xs text-muted-foreground">
        {formatDate(booking.created_at)} · {formatTime(booking.created_at)}
      </td>
      <td className="px-4 py-3 text-right font-medium">
        {formatCurrency(split.gross, split.currency)}
      </td>
      <td className="hidden sm:table-cell px-4 py-3 text-right text-muted-foreground">
        {formatCurrency(split.platformFee, split.currency)}
      </td>
      <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-300">
        {formatCurrency(split.merchantAmount, split.currency)}
      </td>
      <td className="px-4 py-3">
        <Badge variant="warning" className="gap-1">
          <Clock className="h-3 w-3" />
          Held
        </Badge>
      </td>
      <td className="px-4 py-3 text-right">
        <Button size="sm" variant="ghost" onClick={onRelease} disabled={releasing}>
          {releasing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Release now"}
        </Button>
      </td>
    </tr>
  );
}

function PayoutRowEl({ payout }: { payout: PayoutRow }) {
  return (
    <tr className="border-t border-border/50 align-middle">
      <td className="px-4 py-3">
        <div className="font-mono text-xs">{payout.id.slice(0, 12)}</div>
        <div className="text-[11px] text-muted-foreground">
          {payout.provider_transfer_id ?? "—"}
        </div>
      </td>
      <td className="hidden sm:table-cell px-4 py-3 text-xs text-muted-foreground">
        {formatDate(payout.created_at)} · {formatTime(payout.created_at)}
      </td>
      <td className="px-4 py-3 text-right font-medium">
        {formatCurrency(payout.gross_amount, payout.currency)}
      </td>
      <td className="hidden sm:table-cell px-4 py-3 text-right text-muted-foreground">
        {formatCurrency(payout.platform_fee, payout.currency)}
      </td>
      <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-300">
        {formatCurrency(payout.merchant_amount, payout.currency)}
      </td>
      <td className="px-4 py-3">
        <Badge variant={STATUS_VARIANT[payout.status]} className="gap-1">
          {payout.status === "transferred" ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : payout.status === "transfer_failed" ? (
            <AlertTriangle className="h-3 w-3" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {STATUS_LABEL[payout.status]}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right text-[11px] text-muted-foreground">
        {payout.reason.replace(/_/g, " ")}
      </td>
    </tr>
  );
}

function Tile({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "default" | "success" | "warning" | "destructive";
  loading?: boolean;
}) {
  const accentClasses = {
    default: "bg-accent/15 text-accent",
    success: "bg-emerald-500/15 text-emerald-500",
    warning: "bg-amber-500/15 text-amber-500",
    destructive: "bg-rose-500/15 text-rose-500",
  }[accent ?? "default"];
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card>
        <CardContent className="flex items-start justify-between gap-4 pt-5">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {label}
            </div>
            <div className="mt-1 text-xl font-semibold sm:text-2xl">
              {loading ? <Skeleton className="h-6 w-24" /> : value}
            </div>
            {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
          </div>
          <div className={`grid h-10 w-10 place-items-center rounded-xl ${accentClasses}`}>
            <Icon className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
