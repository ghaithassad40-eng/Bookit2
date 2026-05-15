import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type {
  BusinessRow,
  BusinessConfigRow,
  EquipmentRow,
} from "@/lib/database.types";
import {
  useEquipment,
  useUpsertEquipment,
  useDeleteEquipment,
  useToggleEquipmentActive,
  type EquipmentInput,
} from "@/hooks/useEquipment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { defaultCurrencyForCountry } from "@/lib/location";
import { useI18n } from "@/hooks/useI18n";

interface Ctx {
  business: BusinessRow;
  config: BusinessConfigRow;
}

interface DraftEquipment {
  id?: string;
  name: string;
  name_ar: string;
  description: string;
  description_ar: string;
  category: string;
  /** Stored as string in the form so users can clear the field; "" → free. */
  price: string;
  currency: string;
  image_url: string;
  /** Comma-separated tags in the form, split into string[] on save. */
  features: string;
  max_per_booking: number;
  is_active: boolean;
}

function emptyDraft(country: string | null | undefined): DraftEquipment {
  return {
    name: "",
    name_ar: "",
    description: "",
    description_ar: "",
    category: "office",
    price: "",
    currency: defaultCurrencyForCountry(country),
    image_url: "",
    features: "",
    max_per_booking: 1,
    is_active: true,
  };
}

function rowToDraft(row: EquipmentRow): DraftEquipment {
  return {
    id: row.id,
    name: row.name,
    name_ar: row.name_ar ?? "",
    description: row.description ?? "",
    description_ar: row.description_ar ?? "",
    category: row.category,
    price: row.price == null ? "" : String(row.price),
    currency: row.currency,
    image_url: row.image_url ?? "",
    features: row.features.join(", "),
    max_per_booking: row.max_per_booking,
    is_active: row.is_active,
  };
}

function draftToInput(d: DraftEquipment, business_id: string): EquipmentInput {
  const features = d.features
    .split(",")
    .map((f) => f.trim().toLowerCase())
    .filter(Boolean);
  const trimmedPrice = d.price.trim();
  const price = trimmedPrice === "" ? null : Number(trimmedPrice);
  return {
    id: d.id,
    business_id,
    name: d.name.trim(),
    name_ar: d.name_ar.trim() ? d.name_ar.trim() : null,
    description: d.description.trim() ? d.description.trim() : null,
    description_ar: d.description_ar.trim() ? d.description_ar.trim() : null,
    category: d.category.trim() || "office",
    price: Number.isFinite(price as number) ? price : null,
    currency: d.currency.trim() || "KWD",
    image_url: d.image_url.trim() ? d.image_url.trim() : null,
    features,
    max_per_booking: Math.max(1, Math.floor(d.max_per_booking || 1)),
    is_active: d.is_active,
  };
}

export default function Equipment() {
  const { business } = useOutletContext<Ctx>();
  const { t } = useI18n();
  const { data: equipment, isLoading } = useEquipment(business.id, { onlyActive: false });
  const upsert = useUpsertEquipment();
  const remove = useDeleteEquipment(business.id);
  const toggle = useToggleEquipmentActive(business.id);

  const [editing, setEditing] = useState<DraftEquipment | null>(null);

  function startNew() {
    setEditing(emptyDraft(business.country));
  }

  function startEdit(row: EquipmentRow) {
    setEditing(rowToDraft(row));
  }

  async function handleSave() {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast.error(t("admin.equipment.toastNameRequired"));
      return;
    }
    try {
      await upsert.mutateAsync(draftToInput(editing, business.id));
      toast.success(t("admin.equipment.toastSaved"));
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("admin.equipment.toastSaveFailed"));
    }
  }

  async function handleDelete(row: EquipmentRow) {
    if (!confirm(t("admin.equipment.deleteConfirm").replace("{{name}}", row.name))) return;
    try {
      await remove.mutateAsync(row.id);
      toast.success(t("admin.equipment.toastDeleted"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("admin.equipment.toastDeleteFailed"));
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("admin.equipment.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("admin.equipment.subtitle")}
          </p>
        </div>
        <Button onClick={startNew}>
          <Plus className="h-4 w-4" /> {t("admin.equipment.newBtn")}
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            {t("admin.equipment.count").replace(
              "{{count}}",
              String(equipment?.length ?? 0),
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
          ) : equipment?.length ? (
            <ul className="divide-y divide-border/50">
              {equipment.map((e) => (
                <li key={e.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{e.name}</span>
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {e.category}
                      </Badge>
                      <Badge variant={e.is_active ? "success" : "secondary"} className="text-[10px]">
                        {e.is_active
                          ? t("admin.action.active")
                          : t("admin.action.inactive")}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {e.price == null
                        ? t("admin.equipment.includedFree")
                        : formatCurrency(e.price, e.currency)}
                      {" · "}
                      {t("admin.equipment.maxPer").replace(
                        "{{n}}",
                        String(e.max_per_booking),
                      )}
                      {e.features.length > 0 && (
                        <>
                          {" · "}
                          <span className="font-mono">{e.features.slice(0, 4).join(", ")}</span>
                          {e.features.length > 4 && (
                            <span className="opacity-60"> +{e.features.length - 4}</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggle.mutate({ id: e.id, is_active: !e.is_active })}
                    >
                      {e.is_active
                        ? t("admin.action.disable")
                        : t("admin.action.enable")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => startEdit(e)}>
                      {t("admin.action.edit")}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(e)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title={t("admin.equipment.empty")}
              description={t("admin.equipment.emptyBody")}
              action={
                <Button onClick={startNew}>
                  {t("admin.equipment.create")}
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing?.id
                ? t("admin.equipment.dialogEdit")
                : t("admin.equipment.dialogNew")}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Field label={t("admin.equipment.field.nameEn")}>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </Field>
              <Field label={t("admin.equipment.field.nameAr")}>
                <Input
                  dir="rtl"
                  value={editing.name_ar}
                  onChange={(e) => setEditing({ ...editing, name_ar: e.target.value })}
                  placeholder={t("admin.equipment.optionalAr")}
                />
              </Field>
              <Field label={t("admin.equipment.field.descEn")}>
                <Textarea
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={2}
                />
              </Field>
              <Field label={t("admin.equipment.field.descAr")}>
                <Textarea
                  dir="rtl"
                  value={editing.description_ar}
                  onChange={(e) => setEditing({ ...editing, description_ar: e.target.value })}
                  placeholder={t("admin.equipment.optionalAr")}
                  rows={2}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("admin.equipment.field.category")}>
                  <Input
                    value={editing.category}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                    placeholder={t("admin.equipment.categoryPlaceholder")}
                  />
                </Field>
                <Field label={t("admin.equipment.field.maxPer")}>
                  <Input
                    type="number"
                    min={1}
                    value={editing.max_per_booking}
                    onChange={(e) =>
                      setEditing({ ...editing, max_per_booking: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label={t("admin.equipment.field.price")}>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={editing.price}
                    onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                    placeholder={t("admin.equipment.priceFreeHint")}
                  />
                </Field>
                <Field label={t("admin.equipment.field.currency")}>
                  <Input
                    value={editing.currency}
                    onChange={(e) => setEditing({ ...editing, currency: e.target.value })}
                  />
                </Field>
              </div>
              <Field label={t("admin.equipment.field.features")}>
                <Input
                  value={editing.features}
                  onChange={(e) => setEditing({ ...editing, features: e.target.value })}
                  placeholder={t("admin.equipment.featuresPlaceholder")}
                />
                <p className="text-[11px] text-muted-foreground">
                  {t("admin.equipment.featuresHint")}
                </p>
              </Field>
              <Field label={t("admin.equipment.field.image")}>
                <Input
                  value={editing.image_url}
                  onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
                  placeholder="https://…"
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              {t("admin.action.cancel")}
            </Button>
            <Button disabled={upsert.isPending} onClick={handleSave}>
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
