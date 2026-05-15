import { useMemo, useState } from "react";
import { Building2, CheckCircle2, Clock, ShieldOff, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Flag } from "@/components/customer/Flag";
import {
  usePlatformBusinesses,
  useUpdateBusinessStatus,
} from "@/hooks/usePlatformBusinesses";
import { useI18n } from "@/hooks/useI18n";
import { pickLocale } from "@/lib/i18n";
import type { BusinessRow, BusinessStatus } from "@/lib/database.types";
import type { FlagCode } from "@/components/customer/Flag";

const STATUS_FILTER_ORDER: (BusinessStatus | "all")[] = [
  "pending",
  "approved",
  "suspended",
  "rejected",
  "all",
];

const STATUS_VARIANT: Record<
  BusinessStatus,
  "warning" | "success" | "destructive" | "secondary"
> = {
  pending: "warning",
  approved: "success",
  suspended: "destructive",
  rejected: "secondary",
};

export default function PlatformBusinesses() {
  const { t, locale } = useI18n();
  const { data: businesses, isLoading } = usePlatformBusinesses();
  const updateStatus = useUpdateBusinessStatus();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<BusinessStatus | "all">("pending");

  // For the reject confirmation dialog — captures the row + reason.
  const [rejecting, setRejecting] = useState<BusinessRow | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: businesses?.length ?? 0 };
    for (const s of ["pending", "approved", "suspended", "rejected"] as BusinessStatus[]) {
      c[s] =
        businesses?.filter((b) => (b.status ?? "approved") === s).length ?? 0;
    }
    return c;
  }, [businesses]);

  const filtered = useMemo(() => {
    const list = businesses ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((b) => {
      const status = b.status ?? "approved";
      if (filter !== "all" && status !== filter) return false;
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        b.slug.toLowerCase().includes(q) ||
        (b.name_ar ?? "").toLowerCase().includes(q) ||
        (b.country ?? "").toLowerCase().includes(q) ||
        (b.industry ?? "").toLowerCase().includes(q)
      );
    });
  }, [businesses, filter, search]);

  async function setStatus(
    business: BusinessRow,
    status: BusinessStatus,
    reason: string | null = null,
  ) {
    try {
      await updateStatus.mutateAsync({
        id: business.id,
        status,
        rejection_reason: reason,
      });
      toast.success(
        t("platform.toast.statusUpdated")
          .replace("{{name}}", pickLocale(locale, business.name, business.name_ar))
          .replace("{{status}}", t(`approval.statusBadge.${status}` as Parameters<typeof t>[0])),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("platform.toast.failed"));
    }
  }

  async function handleConfirmReject() {
    if (!rejecting) return;
    const trimmed = rejectionReason.trim();
    await setStatus(rejecting, "rejected", trimmed || null);
    setRejecting(null);
    setRejectionReason("");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("platform.businesses.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("platform.businesses.subtitle")}
        </p>
      </header>

      {/* KPI tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          icon={Clock}
          label={t("approval.statusBadge.pending")}
          value={counts.pending}
          accent="warning"
        />
        <Tile
          icon={CheckCircle2}
          label={t("approval.statusBadge.approved")}
          value={counts.approved}
          accent="success"
        />
        <Tile
          icon={ShieldOff}
          label={t("approval.statusBadge.suspended")}
          value={counts.suspended}
          accent="destructive"
        />
        <Tile
          icon={XCircle}
          label={t("approval.statusBadge.rejected")}
          value={counts.rejected}
          accent="secondary"
        />
      </div>

      {/* Search + filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("platform.businesses.search")}
          />
        </div>
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card/40 p-1">
          {STATUS_FILTER_ORDER.map((s) => {
            const label =
              s === "all"
                ? t("admin.bookings.filterAll")
                : t(`approval.statusBadge.${s}` as Parameters<typeof t>[0]);
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === s
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {label} ({counts[s] ?? 0})
              </button>
            );
          })}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {t("platform.businesses.results").replace(
              "{{count}}",
              String(filtered.length),
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Building2 className="mx-auto mb-2 h-6 w-6 opacity-50" />
              {t("platform.businesses.empty")}
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {filtered.map((b) => {
                const status = b.status ?? "approved";
                return (
                  <li key={b.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {pickLocale(locale, b.name, b.name_ar)}
                        </span>
                        <Badge variant={STATUS_VARIANT[status]} className="gap-1 text-[10px]">
                          {t(`approval.statusBadge.${status}` as Parameters<typeof t>[0])}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="font-mono">/{b.slug}</span>
                        <span className="opacity-50">·</span>
                        <span className="uppercase tracking-wide">{b.industry}</span>
                        {b.country && (
                          <>
                            <span className="opacity-50">·</span>
                            <span className="inline-flex items-center gap-1">
                              <Flag code={b.country as FlagCode} className="h-3 w-4" />
                              {b.country}
                            </span>
                          </>
                        )}
                      </div>
                      {status === "rejected" && b.rejection_reason && (
                        <div className="mt-1 text-[11px] text-rose-600 dark:text-rose-300">
                          {t("approval.vendorBanner.reasonLabel")}: {b.rejection_reason}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {status !== "approved" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/5 dark:text-emerald-300"
                          disabled={updateStatus.isPending}
                          onClick={() => setStatus(b, "approved")}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {t("platform.action.approve")}
                        </Button>
                      )}
                      {status !== "suspended" && status !== "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-500/30 text-amber-700 hover:bg-amber-500/5 dark:text-amber-300"
                          disabled={updateStatus.isPending}
                          onClick={() => setStatus(b, "suspended")}
                        >
                          <ShieldOff className="h-3.5 w-3.5" />
                          {t("platform.action.suspend")}
                        </Button>
                      )}
                      {status !== "rejected" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-rose-500/30 text-rose-700 hover:bg-rose-500/5 dark:text-rose-300"
                          disabled={updateStatus.isPending}
                          onClick={() => {
                            setRejecting(b);
                            setRejectionReason(b.rejection_reason ?? "");
                          }}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          {t("platform.action.reject")}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Reject dialog with reason field */}
      <Dialog
        open={!!rejecting}
        onOpenChange={(open) => !open && !updateStatus.isPending && setRejecting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-rose-500/15 text-rose-500">
              <XCircle className="h-5 w-5" />
            </div>
            <DialogTitle>{t("platform.reject.title")}</DialogTitle>
            <DialogDescription>
              {t("platform.reject.body").replace(
                "{{name}}",
                rejecting ? pickLocale(locale, rejecting.name, rejecting.name_ar) : "",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder={t("platform.reject.reasonPlaceholder")}
              rows={3}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={updateStatus.isPending}>
                {t("admin.action.cancel")}
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={updateStatus.isPending}
              onClick={handleConfirmReject}
            >
              <XCircle className="h-4 w-4" />
              {t("platform.reject.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
  accent: "warning" | "success" | "destructive" | "secondary";
}) {
  const tint = {
    warning: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
    success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
    destructive: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
    secondary: "bg-muted text-muted-foreground",
  }[accent];
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${tint}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-semibold leading-none">{value}</div>
          <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
