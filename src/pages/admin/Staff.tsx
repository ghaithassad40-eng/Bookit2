import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { BusinessRow, BusinessConfigRow, StaffRow } from "@/lib/database.types";
import { useStaff } from "@/hooks/useStaff";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";

interface Ctx {
  business: BusinessRow;
  config: BusinessConfigRow;
}

const empty: Partial<StaffRow> = {
  name: "",
  name_ar: "",
  role: "",
  role_ar: "",
  specialty: "",
  specialty_ar: "",
  bio: "",
  bio_ar: "",
  is_active: true,
  rating: 5,
};

export default function Staff() {
  const { business } = useOutletContext<Ctx>();
  const { data: staff, isLoading } = useStaff(business.id, false);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<StaffRow> | null>(null);
  const { t } = useI18n();

  const upsert = useMutation({
    mutationFn: async (input: Partial<StaffRow>) => {
      const payload = { ...input, business_id: business.id };
      const { error } = input.id
        ? await supabase.from("staff").update(payload).eq("id", input.id)
        : await supabase.from("staff").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("admin.staff.toastSaved"));
      qc.invalidateQueries({ queryKey: ["staff", business.id] });
      setEditing(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("admin.staff.toastSaveFailed")),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staff").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("admin.staff.toastDeleted"));
      qc.invalidateQueries({ queryKey: ["staff", business.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("admin.staff.toastDeleteFailed")),
  });

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("admin.staff.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.staff.subtitle")}</p>
        </div>
        <Button onClick={() => setEditing(empty)}>
          <Plus className="h-4 w-4" /> {t("admin.staff.newBtn")}
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            {t("admin.staff.count").replace("{{count}}", String(staff?.length ?? 0))}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : staff?.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {staff.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/40 p-3"
                >
                  <div className="flex items-center gap-3">
                    {p.profile_photo_url ? (
                      <img src={p.profile_photo_url} alt={p.name} className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-accent/15 text-xs font-bold text-accent">
                        {initials(p.name)}
                      </div>
                    )}
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.role} {p.specialty ? `· ${p.specialty}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant={p.is_active ? "success" : "secondary"}>
                      {p.is_active ? t("admin.action.active") : t("admin.action.inactive")}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>
                      {t("admin.action.edit")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        confirm(t("admin.staff.deleteConfirm").replace("{{name}}", p.name)) &&
                        remove.mutate(p.id)
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title={t("admin.staff.empty")}
              description={t("admin.staff.emptyBody")}
              action={<Button onClick={() => setEditing(empty)}>{t("admin.staff.newBtn")}</Button>}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? t("admin.staff.dialogEdit") : t("admin.staff.dialogNew")}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("admin.staff.field.nameEn")}>
                  <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </Field>
                <Field label={t("admin.staff.field.nameAr")}>
                  <Input
                    dir="rtl"
                    value={editing.name_ar ?? ""}
                    onChange={(e) => setEditing({ ...editing, name_ar: e.target.value })}
                    placeholder={t("admin.staff.optional")}
                  />
                </Field>
                <Field label={t("admin.staff.field.roleEn")}>
                  <Input value={editing.role ?? ""} onChange={(e) => setEditing({ ...editing, role: e.target.value })} />
                </Field>
                <Field label={t("admin.staff.field.roleAr")}>
                  <Input
                    dir="rtl"
                    value={editing.role_ar ?? ""}
                    onChange={(e) => setEditing({ ...editing, role_ar: e.target.value })}
                    placeholder={t("admin.staff.optional")}
                  />
                </Field>
                <Field label={t("admin.staff.field.specialtyEn")}>
                  <Input
                    value={editing.specialty ?? ""}
                    onChange={(e) => setEditing({ ...editing, specialty: e.target.value })}
                  />
                </Field>
                <Field label={t("admin.staff.field.specialtyAr")}>
                  <Input
                    dir="rtl"
                    value={editing.specialty_ar ?? ""}
                    onChange={(e) => setEditing({ ...editing, specialty_ar: e.target.value })}
                    placeholder={t("admin.staff.optional")}
                  />
                </Field>
                <Field label={t("admin.staff.field.rating")}>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    max={5}
                    value={editing.rating ?? 5}
                    onChange={(e) => setEditing({ ...editing, rating: Number(e.target.value) })}
                  />
                </Field>
                <Field label={t("admin.staff.field.photo")}>
                  <Input
                    value={editing.profile_photo_url ?? ""}
                    onChange={(e) => setEditing({ ...editing, profile_photo_url: e.target.value })}
                  />
                </Field>
              </div>
              <Field label={t("admin.staff.field.bioEn")}>
                <Textarea
                  value={editing.bio ?? ""}
                  onChange={(e) => setEditing({ ...editing, bio: e.target.value })}
                />
              </Field>
              <Field label={t("admin.staff.field.bioAr")}>
                <Textarea
                  dir="rtl"
                  value={editing.bio_ar ?? ""}
                  onChange={(e) => setEditing({ ...editing, bio_ar: e.target.value })}
                  placeholder={t("admin.staff.optional")}
                />
              </Field>
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
