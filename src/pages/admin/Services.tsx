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
import { useI18n } from "@/hooks/useI18n";

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
  const { t } = useI18n();
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
      toast.success(t("admin.services.toastSaved"));
      qc.invalidateQueries({ queryKey: ["services", business.id] });
      setEditing(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("admin.services.toastSaveFailed")),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("admin.services.toastDeleted"));
      qc.invalidateQueries({ queryKey: ["services", business.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("admin.services.toastDeleteFailed")),
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
          <h1 className="text-2xl font-semibold tracking-tight">{t("admin.services.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.services.subtitle")}</p>
        </div>
        <Button onClick={() => setEditing(empty)}>
          <Plus className="h-4 w-4" /> {t("admin.services.newBtn")}
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            {t("admin.services.count").replace("{{count}}", String(services?.length ?? 0))}
          </CardTitle>
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
                        {s.duration_minutes} {t("service.minutes")} · {formatCurrency(s.price, s.currency)} · {t("admin.services.cap")} {s.capacity}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={s.is_active ? "success" : "secondary"}>
                      {s.is_active ? t("admin.action.active") : t("admin.action.inactive")}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => toggle.mutate(s)}>
                      {s.is_active ? t("admin.action.disable") : t("admin.action.enable")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(s)}>
                      {t("admin.action.edit")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        confirm(t("admin.services.deleteConfirm").replace("{{name}}", s.name)) &&
                        remove.mutate(s.id)
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title={t("admin.services.empty")}
              description={t("admin.services.emptyBody")}
              action={<Button onClick={() => setEditing(empty)}>{t("admin.services.create")}</Button>}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? t("admin.services.dialogEdit") : t("admin.services.dialogNew")}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Field label={t("admin.services.field.nameEn")}>
                <Input
                  value={editing.name ?? ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </Field>
              <Field label={t("admin.services.field.nameAr")}>
                <Input
                  dir="rtl"
                  value={editing.name_ar ?? ""}
                  onChange={(e) => setEditing({ ...editing, name_ar: e.target.value })}
                  placeholder={t("admin.services.optionalAr")}
                />
              </Field>
              <Field label={t("admin.services.field.descEn")}>
                <Textarea
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </Field>
              <Field label={t("admin.services.field.descAr")}>
                <Textarea
                  dir="rtl"
                  value={editing.description_ar ?? ""}
                  onChange={(e) => setEditing({ ...editing, description_ar: e.target.value })}
                  placeholder={t("admin.services.optionalAr")}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("admin.services.field.duration")}>
                  <Input
                    type="number"
                    value={editing.duration_minutes ?? 0}
                    onChange={(e) => setEditing({ ...editing, duration_minutes: Number(e.target.value) })}
                  />
                </Field>
                <Field label={t("admin.services.field.capacity")}>
                  <Input
                    type="number"
                    value={editing.capacity ?? 1}
                    onChange={(e) => setEditing({ ...editing, capacity: Number(e.target.value) })}
                  />
                </Field>
                <Field label={t("admin.services.field.price")}>
                  <Input
                    type="number"
                    step="0.01"
                    value={editing.price ?? 0}
                    onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
                  />
                </Field>
                <Field label={t("admin.services.field.currency")}>
                  <Input
                    value={editing.currency ?? defaultCurrencyForCountry(business.country)}
                    onChange={(e) => setEditing({ ...editing, currency: e.target.value })}
                  />
                </Field>
                <Field label={t("admin.services.field.color")}>
                  <Input
                    type="color"
                    value={editing.color ?? "#3B82F6"}
                    onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                  />
                </Field>
                <Field label={t("admin.services.field.image")}>
                  <Input
                    value={editing.image_url ?? ""}
                    onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>{t("admin.action.cancel")}</Button>
            <Button disabled={upsert.isPending} onClick={() => editing && upsert.mutate(editing)}>
              {t("admin.action.save")}
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
