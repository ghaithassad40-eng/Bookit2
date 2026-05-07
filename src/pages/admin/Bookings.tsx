import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Search } from "lucide-react";
import type { BookingRow, BusinessRow, BusinessConfigRow } from "@/lib/database.types";
import { useBookings, useUpdateBookingStatus } from "@/hooks/useBookings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, formatTime } from "@/lib/utils";
import { toast } from "sonner";

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
  const updateStatus = useUpdateBookingStatus();

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
        <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
        <p className="text-sm text-muted-foreground">All reservations across all services.</p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or reference"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card/40 p-1">
          {(["all", ...STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === s ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {s.replace("_", " ")} ({grouped[s] ?? 0})
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{data?.length ?? 0} results</CardTitle>
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
                    <th className="px-4 py-3 text-left">Reference</th>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-left hidden sm:table-cell">Created</th>
                    <th className="px-4 py-3 text-left">Status</th>
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
                        <Badge variant={STATUS_VARIANT[b.status]}>{b.status.replace("_", " ")}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setSelected(b)}>
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No bookings yet" description="Once your customers book, they'll show up here." />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.customer_name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              <Row label="Reference" value={selected.booking_reference} />
              <Row label="Status" value={selected.status} />
              {selected.customer_email && <Row label="Email" value={selected.customer_email} />}
              {selected.customer_phone && <Row label="Phone" value={selected.customer_phone} />}
              {selected.notes && <Row label="Notes" value={selected.notes} />}
              <Row label="Created" value={`${formatDate(selected.created_at)} · ${formatTime(selected.created_at)}`} />
              <div className="flex flex-wrap gap-2 pt-3">
                {STATUSES.filter((s) => s !== selected.status).map((s) => (
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
                        toast.success(`Marked ${s.replace("_", " ")}`);
                        setSelected({ ...selected, status: s });
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Update failed");
                      }
                    }}
                  >
                    Mark {s.replace("_", " ")}
                  </Button>
                ))}
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
