import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Download, Loader2, Search, XCircle } from "lucide-react";
import type { BookingRow, BusinessRow, BusinessConfigRow } from "@/lib/database.types";
import { useBookings, useCancelBooking, useUpdateBookingStatus } from "@/hooks/useBookings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate, formatTime } from "@/lib/utils";
import { toast } from "sonner";
import { downloadCsv, toCsv } from "@/lib/csv";
import { useI18n } from "@/hooks/useI18n";
import type { TranslationKey } from "@/lib/i18n";

interface Ctx {
  business: BusinessRow;
  config: BusinessConfigRow;
}

const STATUSES: BookingRow["status"][] = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
];

const STATUS_VARIANT: Record<BookingRow["status"], "default" | "success" | "warning" | "destructive" | "secondary"> = {
  pending: "warning",
  confirmed: "default",
  completed: "success",
  cancelled: "destructive",
  no_show: "secondary",
};

export default function Bookings() {
  const { business } = useOutletContext<Ctx>();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<BookingRow["status"] | "all">("all");
  const [selected, setSelected] = useState<BookingRow | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<BookingRow | null>(null);
  const updateStatus = useUpdateBookingStatus();
  const cancelMutation = useCancelBooking();
  const { t } = useI18n();

  const { data, isLoading } = useBookings({
    businessId: business.id,
    status: filter === "all" ? undefined : filter,
    search,
  });

  const grouped = useMemo(() => {
    const counts: Record<string, number> = { all: data?.length ?? 0 };
    STATUSES.forEach((s) => (counts[s] = data?.filter((b) => b.status === s).length ?? 0));
    return counts;
  }, [data]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("admin.bookings.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin.bookings.subtitle")}</p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("admin.bookings.search")}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card/40 p-1">
          {(["all", ...STATUSES] as const).map((s) => {
            const label =
              s === "all"
                ? t("admin.bookings.filterAll")
                : t(`status.${s}` as TranslationKey);
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === s ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {label} ({grouped[s] ?? 0})
              </button>
            );
          })}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>
            {t("admin.bookings.results").replace("{{count}}", String(data?.length ?? 0))}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            disabled={!data || data.length === 0}
            onClick={() => {
              if (!data || data.length === 0) return;
              const rows = data.map((b) => ({
                reference: b.booking_reference,
                created_at: b.created_at,
                customer_name: b.customer_name,
                customer_email: b.customer_email ?? "",
                customer_phone: b.customer_phone ?? "",
                service_id: b.service_id,
                staff_id: b.staff_id ?? "",
                status: b.status,
                payment_status: b.payment_status ?? "",
                payment_method: b.payment_method ?? "",
                payment_amount: b.payment_amount ?? "",
                payment_currency: b.payment_currency ?? "",
                payment_transaction_id: b.payment_transaction_id ?? "",
                payout_status: b.payout_status ?? "",
                notes: b.notes ?? "",
              }));
              const csv = toCsv(rows);
              const stamp = new Date().toISOString().slice(0, 10);
              downloadCsv(`${business.slug}-bookings-${stamp}.csv`, csv);
              toast.success(t("admin.bookings.exported").replace("{{count}}", String(rows.length)));
            }}
          >
            <Download className="h-3.5 w-3.5" />
            {t("admin.bookings.exportCsv")}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : data?.length ? (
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-start">{t("admin.bookings.col.reference")}</th>
                    <th className="px-4 py-3 text-start">{t("admin.bookings.col.customer")}</th>
                    <th className="px-4 py-3 text-start hidden sm:table-cell">{t("admin.bookings.col.created")}</th>
                    <th className="px-4 py-3 text-start">{t("admin.bookings.col.status")}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {data.map((b) => (
                    <tr key={b.id} className="border-t border-border/50">
                      <td className="px-4 py-3 font-mono text-xs">{b.booking_reference}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{b.customer_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {b.customer_email || b.customer_phone || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-xs text-muted-foreground">
                        {formatDate(b.created_at)} · {formatTime(b.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[b.status]}>
                          {t(`status.${b.status}` as TranslationKey)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-end">
                        <Button size="sm" variant="ghost" onClick={() => setSelected(b)}>
                          {t("admin.bookings.action.view")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title={t("admin.bookings.empty")}
              description={t("admin.bookings.emptyBody")}
            />
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!cancelConfirm}
        onOpenChange={(open) => !open && !cancelMutation.isPending && setCancelConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-rose-500/15 text-rose-500">
              <XCircle className="h-5 w-5" />
            </div>
            <DialogTitle>{t("admin.bookings.cancelDialogTitle")}</DialogTitle>
            <DialogDescription>
              {(cancelConfirm?.payment_status === "paid"
                ? t("admin.bookings.cancelDialogPaid")
                : t("admin.bookings.cancelDialogUnpaid")
              ).replace(
                "{{name}}",
                cancelConfirm?.customer_name ?? t("admin.bookings.fallbackCustomer"),
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={cancelMutation.isPending}>
                {t("admin.bookings.keepBooking")}
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={cancelMutation.isPending}
              onClick={async () => {
                if (!cancelConfirm) return;
                try {
                  const result = await cancelMutation.mutateAsync({
                    id: cancelConfirm.id,
                    business_id: cancelConfirm.business_id,
                  });
                  toast.success(
                    (result.refunded
                      ? t("admin.bookings.toastCancelRefunded")
                      : t("admin.bookings.toastCancelled")
                    ).replace("{{name}}", cancelConfirm.customer_name),
                  );
                  // Keep the detail dialog open and reflect the new status.
                  if (selected?.id === cancelConfirm.id) {
                    setSelected({ ...selected, ...result.booking });
                  }
                  setCancelConfirm(null);
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : t("admin.bookings.toastCancelFailed"),
                  );
                }
              }}
            >
              {cancelMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {t("admin.bookings.cancelling")}
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" /> {t("admin.bookings.confirmCancel")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.customer_name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              <Row label={t("admin.bookings.col.reference")} value={selected.booking_reference} />
              <Row label={t("admin.bookings.col.status")} value={t(`status.${selected.status}` as TranslationKey)} />
              {selected.customer_email && <Row label={t("admin.bookings.row.email")} value={selected.customer_email} />}
              {selected.customer_phone && <Row label={t("admin.bookings.row.phone")} value={selected.customer_phone} />}
              {selected.notes && <Row label={t("admin.bookings.row.notes")} value={selected.notes} />}
              <Row label={t("admin.bookings.col.created")} value={`${formatDate(selected.created_at)} · ${formatTime(selected.created_at)}`} />
              <div className="flex flex-wrap gap-2 pt-3">
                {STATUSES.filter((s) => s !== selected.status).map((s) => {
                  const statusLabel = t(`status.${s}` as TranslationKey);
                  // "Cancelled" is special — it triggers the refund flow via a
                  // confirmation dialog. The other statuses are plain updates.
                  if (s === "cancelled") {
                    return (
                      <Button
                        key={s}
                        size="sm"
                        variant="outline"
                        className="border-rose-500/30 text-rose-600 hover:bg-rose-500/5 dark:text-rose-300"
                        onClick={() => setCancelConfirm(selected)}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        {t("admin.bookings.action.cancelRefund")}
                      </Button>
                    );
                  }
                  return (
                    <Button
                      key={s}
                      size="sm"
                      variant="outline"
                      disabled={updateStatus.isPending}
                      onClick={async () => {
                        try {
                          await updateStatus.mutateAsync({
                            id: selected.id,
                            status: s,
                            businessId: selected.business_id,
                          });
                          toast.success(
                            t("admin.bookings.toastMarked").replace("{{status}}", statusLabel),
                          );
                          setSelected({ ...selected, status: s });
                        } catch (e) {
                          toast.error(
                            e instanceof Error ? e.message : t("admin.bookings.toastUpdateFailed"),
                          );
                        }
                      }}
                    >
                      {t("admin.bookings.action.mark")} {statusLabel}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-1.5 last:border-none">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
