import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { BusinessRow, BusinessConfigRow, TimeSlotRow } from "@/lib/database.types";
import { useSlots } from "@/hooks/useSlots";
import { useServices } from "@/hooks/useServices";
import { useStaff } from "@/hooks/useStaff";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatTime, groupBy } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";

interface Ctx {
  business: BusinessRow;
  config: BusinessConfigRow;
}

export default function Slots() {
  const { business } = useOutletContext<Ctx>();
  const { data: slots, isLoading } = useSlots({ businessId: business.id });
  const { data: services } = useServices(business.id, { onlyActive: false });
  const { data: staff } = useStaff(business.id, false);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const [draft, setDraft] = useState({
    service_id: "",
    staff_id: "",
    date: new Date().toISOString().slice(0, 10),
    start: "09:00",
    end: "10:00",
    capacity: 1,
  });

  const grouped = useMemo(() => {
    if (!slots) return {};
    return groupBy(slots, (s) => s.start_time.slice(0, 10));
  }, [slots]);

  const create = useMutation({
    mutationFn: async () => {
      const start = new Date(`${draft.date}T${draft.start}:00`).toISOString();
      const end = new Date(`${draft.date}T${draft.end}:00`).toISOString();
      const { error } = await supabase.from("time_slots").insert({
        business_id: business.id,
        service_id: draft.service_id || null,
        staff_id: draft.staff_id || null,
        start_time: start,
        end_time: end,
        capacity: draft.capacity,
        status: "open",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Slot created");
      qc.invalidateQueries({ queryKey: ["slots", business.id] });
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Create failed"),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TimeSlotRow["status"] }) => {
      const { error } = await supabase.from("time_slots").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["slots", business.id] }),
  });

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("admin.slots.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.slots.subtitle")}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> {t("admin.slots.newBtn")}
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.slots.upcoming")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : Object.keys(grouped).length === 0 ? (
            <EmptyState title="No slots scheduled" />
          ) : (
            Object.entries(grouped).map(([day, daySlots]) => (
              <div key={day}>
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                  {formatDate(day + "T00:00:00")}
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {daySlots.map((s) => {
                    const svc = services?.find((x) => x.id === s.service_id);
                    const stf = staff?.find((x) => x.id === s.staff_id);
                    return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-xl border border-border/60 bg-card/40 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-medium">
                          {formatTime(s.start_time)} – {formatTime(s.end_time)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {svc ? svc.name : t("admin.slots.anyService")}
                          {stf ? ` · ${stf.name}` : ""}
                          {" · "}
                          {s.booked_count}/{s.capacity} booked
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            s.status === "open"
                              ? "success"
                              : s.status === "full"
                              ? "warning"
                              : s.status === "cancelled"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {s.status}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            updateStatus.mutate({
                              id: s.id,
                              status: s.status === "open" ? "closed" : "open",
                            })
                          }
                        >
                          {s.status === "open" ? "Close" : "Open"}
                        </Button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New slot</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Service">
              <select
                className="flex h-11 w-full rounded-xl border border-border bg-background/50 px-3 text-sm"
                value={draft.service_id}
                onChange={(e) => setDraft({ ...draft, service_id: e.target.value })}
              >
                <option value="">— Any —</option>
                {services?.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Staff">
              <select
                className="flex h-11 w-full rounded-xl border border-border bg-background/50 px-3 text-sm"
                value={draft.staff_id}
                onChange={(e) => setDraft({ ...draft, staff_id: e.target.value })}
              >
                <option value="">— Any —</option>
                {staff?.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Date">
                <Input
                  type="date"
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                />
              </Field>
              <Field label="Start">
                <Input
                  type="time"
                  value={draft.start}
                  onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                />
              </Field>
              <Field label="End">
                <Input
                  type="time"
                  value={draft.end}
                  onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Capacity">
              <Input
                type="number"
                min={1}
                value={draft.capacity}
                onChange={(e) => setDraft({ ...draft, capacity: Number(e.target.value) })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={create.isPending} onClick={() => create.mutate()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
