import { useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  Search,
  ShieldOff,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";

const STATUS_FILTER_ORDER: (BusinessStatus | "all")[] = [
  "pending",
  "approved",
  "suspended",
  "rejected",
  "all",
];

/** Background tint + dot colour per status. Kept terminal-light (no big
 *  pill badges) so the table reads at a glance. */
const STATUS_DOT: Record<BusinessStatus, string> = {
  pending: "bg-amber-500",
  approved: "bg-emerald-500",
  suspended: "bg-rose-500",
  rejected: "bg-muted-foreground",
};

const STATUS_TEXT: Record<BusinessStatus, string> = {
  pending: "text-amber-600",
  approved: "text-emerald-600",
  suspended: "text-rose-600",
  rejected: "text-muted-foreground",
};

export default function PlatformBusinesses() {
  const { t, locale } = useI18n();
  const { data: businesses, isLoading } = usePlatformBusinesses();
  const updateStatus = useUpdateBusinessStatus();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<BusinessStatus | "all">("pending");

  // Reject dialog — same flow as before, kept consistent.
  const [rejecting, setRejecting] = useState<BusinessRow | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: businesses?.length ?? 0 };
    for (const s of ["pending", "approved", "suspended", "rejected"] as BusinessStatus[]) {
      c[s] = businesses?.filter((b) => (b.status ?? "approved") === s).length ?? 0;
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
    <div className="space-y-5">
      {/* Console-style page header — left-aligned label + monospace path */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            <span>{t("platform.consoleLabel")}</span>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-brand-gold">{t("platform.nav.businesses")}</span>
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
            {t("platform.businesses.title")}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {t("platform.businesses.subtitle")}
          </p>
        </div>
      </header>

      {/* Search + filter chips — sharper edges, monospace counts */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("platform.businesses.search")}
            className="h-9 ps-9 text-sm focus-visible:ring-brand-gold/40"
          />
        </div>
        <div className="flex gap-0.5 overflow-x-auto rounded-md border border-border bg-card p-0.5">
          {STATUS_FILTER_ORDER.map((s) => {
            const label =
              s === "all"
                ? t("admin.bookings.filterAll")
                : t(`approval.statusBadge.${s}` as Parameters<typeof t>[0]);
            const active = filter === s;
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={cn(
                  "shrink-0 rounded px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider transition-colors",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {label}{" "}
                <span className="ms-1 font-mono tabular-nums text-muted-foreground/70">
                  {(counts[s] ?? 0).toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Data table — dense, terminal-like, sharper than the vendor admin */}
      <div className="overflow-hidden rounded-md border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t("platform.businesses.results").replace(
              "{{count}}",
              String(filtered.length),
            )}
          </div>
          {!isLoading && filtered.length > 0 && (
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
              {filter === "all" ? "ALL" : filter.toUpperCase()} · {filtered.length} ROWS
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3.5">
                <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-2.5 w-1/2 animate-pulse rounded bg-muted/60" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <Building2 className="mx-auto mb-2 h-5 w-5 text-muted-foreground/60" />
            <div className="text-sm text-muted-foreground">
              {t("platform.businesses.empty")}
            </div>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-4 py-2 font-medium">{t("platform.col.status")}</th>
                <th className="px-4 py-2 font-medium">{t("platform.col.business")}</th>
                <th className="hidden px-4 py-2 font-medium md:table-cell">
                  {t("platform.col.industry")}
                </th>
                <th className="hidden px-4 py-2 font-medium md:table-cell">
                  {t("platform.col.country")}
                </th>
                <th className="px-4 py-2 text-end font-medium">
                  {t("platform.col.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((b) => {
                const status = (b.status ?? "approved") as BusinessStatus;
                return (
                  <tr key={b.id} className="group transition-colors hover:bg-muted/40">
                    {/* Status — dot + label, compact */}
                    <td className="px-4 py-3 align-top">
                      <div className="inline-flex items-center gap-2">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full shadow-[0_0_6px_currentColor]",
                            STATUS_DOT[status],
                          )}
                        />
                        <span
                          className={cn(
                            "text-[10px] font-semibold uppercase tracking-wider",
                            STATUS_TEXT[status],
                          )}
                        >
                          {t(`approval.statusBadge.${status}` as Parameters<typeof t>[0])}
                        </span>
                      </div>
                    </td>
                    {/* Business */}
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium">
                        {pickLocale(locale, b.name, b.name_ar)}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                        <span>/{b.slug}</span>
                      </div>
                      {status === "rejected" && b.rejection_reason && (
                        <div className="mt-1 text-[10px] text-rose-600/80">
                          {t("approval.vendorBanner.reasonLabel")}: {b.rejection_reason}
                        </div>
                      )}
                    </td>
                    {/* Industry */}
                    <td className="hidden px-4 py-3 align-top text-[11px] uppercase tracking-wider text-muted-foreground md:table-cell">
                      {b.industry}
                    </td>
                    {/* Country */}
                    <td className="hidden px-4 py-3 align-top md:table-cell">
                      {b.country ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                          <Flag code={b.country as FlagCode} className="h-3 w-4" />
                          {b.country}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/60">—</span>
                      )}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {status !== "approved" && (
                          <RowAction
                            tone="emerald"
                            disabled={updateStatus.isPending}
                            onClick={() => setStatus(b, "approved")}
                            icon={CheckCircle2}
                            label={t("platform.action.approve")}
                          />
                        )}
                        {status !== "suspended" && status !== "pending" && (
                          <RowAction
                            tone="amber"
                            disabled={updateStatus.isPending}
                            onClick={() => setStatus(b, "suspended")}
                            icon={ShieldOff}
                            label={t("platform.action.suspend")}
                          />
                        )}
                        {status !== "rejected" && (
                          <RowAction
                            tone="rose"
                            disabled={updateStatus.isPending}
                            onClick={() => {
                              setRejecting(b);
                              setRejectionReason(b.rejection_reason ?? "");
                            }}
                            icon={XCircle}
                            label={t("platform.action.reject")}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Reject dialog — kept the same flow but skinned to the dark console */}
      <Dialog
        open={!!rejecting}
        onOpenChange={(open) => !open && !updateStatus.isPending && setRejecting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <div className="mb-3 grid h-11 w-11 place-items-center rounded-md bg-rose-500/15 text-rose-400">
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

// ─── Row-level action button — tight, terminal-flavoured ────────────────────

function RowAction({
  icon: Icon,
  label,
  tone,
  disabled,
  onClick,
}: {
  icon: typeof CheckCircle2;
  label: string;
  tone: "emerald" | "amber" | "rose";
  disabled?: boolean;
  onClick: () => void;
}) {
  const toneClass: Record<typeof tone, string> = {
    emerald:
      "border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 hover:border-emerald-500/50",
    amber:
      "border-amber-500/30 text-amber-700 hover:bg-amber-500/10 hover:border-amber-500/50",
    rose:
      "border-rose-500/30 text-rose-700 hover:bg-rose-500/10 hover:border-rose-500/50",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded border bg-transparent px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors disabled:opacity-50",
        toneClass[tone],
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

// Suppress unused-import warning if ChevronDown isn't referenced (kept for future
// row expansion). Re-export to make the linter happy without altering shape.
void ChevronDown;
