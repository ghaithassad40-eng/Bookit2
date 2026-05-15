import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { BusinessRow, BusinessConfigRow, ServiceRow } from "@/lib/database.types";
import { useServices } from "@/hooks/useServices";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { defaultCurrencyForCountry } from "@/lib/location";

interface Ctx {
  business: BusinessRow;
  config: BusinessConfigRow;
}

function buildEmptyService(country: string | null | undefined): Partial<ServiceRow> {
  return {
    name: "",
    name_ar: "",
    description: "",
    description_ar: "",
    duration_minutes: 60,
    price: 50,
    // Default the currency to the business's country so a KW vendor doesn't
    // have to manually edit every new service away from USD.
    currency: defaultCurrencyForCountry(country),
    capacity: 1,
    color: "#3B82F6",
    is_active: true,
  };
}

export default function Services() {
  const { business } = useOutletContext<Ctx>();
  const empty = buildEmptyService(business.country);
  const { data: services, isLoading } = useServices(business.id, { onlyActive: false });
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<ServiceRow> | null>(null);

  const upsert = useMutation({
    mutationFn: async (input: Partial<ServiceRow>) => {
      const payload = { ...input, business_id: business.id };
      const { error } = input.id
        ? await supabase.from("services").update(payload).eq("id", input.id)
        : await supabase.from("services").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["services", business.id] });
      setEditing(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["services", business.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const toggle = useMutation({
    mutationFn: async (svc: ServiceRow) => {
      const { error } = await supabase
        .from("services")
        .update({ is_active: !svc.is_active })
        .eq("id", svc.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services", business.id] }),
  });

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Services</h1>
          <p className="text-sm text-muted-foreground">Define what customers can book.</p>
        </div>
        <Button onClick={() => setEditing(empty)}>
          <Plus className="h-4 w-4" /> New service
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{services?.length ?? 0} services</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : services?.length ? (
            <ul className="divide-y divide-border/50">
              {services.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ background: s.color ?? "#3B82F6" }} />
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.duration_minutes} min · {formatCurrency(s.price, s.currency)} · cap {s.capacity}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={s.is_active ? "success" : "secondary"}>
                      {s.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => toggle.mutate(s)}>
                      {s.is_active ? "Disable" : "Enable"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(s)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => confirm(`Delete "${s.name}"?`) && remove.mutate(s.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No services yet"
              description="Create your first bookable service to get started."
              action={<Button onClick={() => setEditing(empty)}>Create service</Button>}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit service" : "New service"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Field label="Name (English)">
                <Input
                  value={editing.name ?? ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </Field>
              <Field label="Name (العربية)">
                <Input
                  dir="rtl"
                  value={editing.name_ar ?? ""}
                  onChange={(e) => setEditing({ ...editing, name_ar: e.target.value })}
                  placeholder="ترجمة عربية اختيارية"
                />
              </Field>
              <Field label="Description (English)">
                <Textarea
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </Field>
              <Field label="Description (العربية)">
                <Textarea
                  dir="rtl"
                  value={editing.description_ar ?? ""}
                  onChange={(e) => setEditing({ ...editing, description_ar: e.target.value })}
                  placeholder="ترجمة عربية اختيارية"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Duration (min)">
                  <Input
                    type="number"
                    value={editing.duration_minutes ?? 0}
                    onChange={(e) => setEditing({ ...editing, duration_minutes: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Capacity">
                  <Input
                    type="number"
                    value={editing.capacity ?? 1}
                    onChange={(e) => setEditing({ ...editing, capacity: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Price">
                  <Input
                    type="number"
                    step="0.01"
                    value={editing.price ?? 0}
                    onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Currency">
                  <Input
                    value={editing.currency ?? defaultCurrencyForCountry(business.country)}
                    onChange={(e) => setEditing({ ...editing, currency: e.target.value })}
                  />
                </Field>
                <Field label="Color">
                  <Input
                    type="color"
                    value={editing.color ?? "#3B82F6"}
                    onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                  />
                </Field>
                <Field label="Image URL">
                  <Input
                    value={editing.image_url ?? ""}
                    onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={upsert.isPending} onClick={() => editing && upsert.mutate(editing)}>
              Save
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
