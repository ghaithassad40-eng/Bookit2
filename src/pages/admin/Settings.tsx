import { useOutletContext } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, Wallet } from "lucide-react";
import type { BusinessRow, BusinessConfigRow, CopyJson } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JsonConfigEditor } from "@/components/admin/JsonConfigEditor";
import { BrandGeneratorPanel } from "@/components/admin/BrandGeneratorPanel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useI18n } from "@/hooks/useI18n";

interface Ctx {
  business: BusinessRow;
  config: BusinessConfigRow;
}

type ConfigKey =
  | "theme_json"
  | "copy_json"
  | "copy_json_ar"
  | "booking_rules_json"
  | "layout_json";

export default function Settings() {
  const { business, config } = useOutletContext<Ctx>();
  const qc = useQueryClient();
  const { t } = useI18n();
  const [name, setName] = useState(business.name);
  const [nameAr, setNameAr] = useState(business.name_ar ?? "");
  const [slug, setSlug] = useState(business.slug);
  const [logoUrl, setLogoUrl] = useState(business.logo_url ?? "");

  // Escrow / commission state
  const [commissionPct, setCommissionPct] = useState(
    (business.commission_bps / 100).toString(),
  );
  const [iban, setIban] = useState(business.iban_last4 ?? "");
  const [connectedId, setConnectedId] = useState(business.connected_account_id ?? "");
  const [payoutsEnabled, setPayoutsEnabled] = useState(business.payouts_enabled);

  const saveEscrow = useMutation({
    mutationFn: async () => {
      const bps = Math.round(parseFloat(commissionPct || "0") * 100);
      if (Number.isNaN(bps) || bps < 0 || bps > 5000) {
        throw new Error("Commission must be between 0 and 50%");
      }
      const { error } = await supabase
        .from("businesses")
        .update({
          commission_bps: bps,
          iban_last4: iban || null,
          connected_account_id: connectedId || null,
          payouts_enabled: payoutsEnabled,
        })
        .eq("id", business.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payout settings saved");
      qc.invalidateQueries({ queryKey: ["business", business.slug] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const updateBusiness = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("businesses")
        .update({
          name,
          name_ar: nameAr.trim() ? nameAr.trim() : null,
          slug,
          logo_url: logoUrl || null,
        })
        .eq("id", business.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Business updated");
      qc.invalidateQueries({ queryKey: ["business", business.slug] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const saveJson = useMutation({
    mutationFn: async ({ key, value }: { key: ConfigKey; value: object }) => {
      // upsert ensures a row exists if previously missing
      const payload = {
        business_id: business.id,
        [key]: value,
      };
      const { error } = await supabase
        .from("business_configs")
        .upsert(payload, { onConflict: "business_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Config saved");
      qc.invalidateQueries({ queryKey: ["business", business.slug] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("admin.settings.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("admin.settings.subtitle")}
        </p>
      </header>

      <BrandGeneratorPanel
        business={business}
        config={config}
        onApplied={() => qc.invalidateQueries({ queryKey: ["business", business.slug] })}
      />

      <Card>
        <CardHeader>
          <CardTitle>Business profile</CardTitle>
          <CardDescription>Public-facing identity for /business/{business.slug}.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Field label="Display name (English)">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Display name (العربية)">
            <Input
              dir="rtl"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              placeholder="ترجمة عربية اختيارية"
            />
          </Field>
          <Field label="Slug">
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
          </Field>
          <Field label="Logo URL">
            <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
          </Field>
          <div className="sm:col-span-3">
            <Button disabled={updateBusiness.isPending} onClick={() => updateBusiness.mutate()}>
              Save profile
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-500">
            <Wallet className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <CardTitle>Payouts &amp; commission</CardTitle>
            <CardDescription>
              Funds are held in escrow until each booking's service window closes, then split: your share is
              wired to your bank, the platform fee is netted automatically.
            </CardDescription>
          </div>
          <Badge variant={payoutsEnabled ? "success" : "warning"} className="gap-1">
            <ShieldCheck className="h-3 w-3" />
            {payoutsEnabled ? "Active" : "Setup required"}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="Commission (%)">
            <Input
              type="number"
              step="0.01"
              min="0"
              max="50"
              value={commissionPct}
              onChange={(e) => setCommissionPct(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Stored as basis points · 1 bps = 0.01% · max 50%
            </p>
          </Field>
          <Field label="IBAN (last 4)">
            <Input
              value={iban}
              onChange={(e) => setIban(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="4321"
            />
            <p className="text-[11px] text-muted-foreground">
              Display only — your full IBAN is held by the payment provider.
            </p>
          </Field>
          <Field label="Connected account ID">
            <Input
              value={connectedId}
              onChange={(e) => setConnectedId(e.target.value)}
              placeholder="acct_…"
            />
            <p className="text-[11px] text-muted-foreground">
              Identifier returned by the payment provider after KYC onboarding.
            </p>
          </Field>
          <Field label="Status">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card/50 px-3 py-2.5">
              <button
                type="button"
                role="switch"
                aria-checked={payoutsEnabled}
                onClick={() => setPayoutsEnabled((v) => !v)}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                  payoutsEnabled ? "bg-emerald-500" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                    payoutsEnabled ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </button>
              <span className="text-sm">
                Payouts {payoutsEnabled ? "enabled" : "disabled"}
              </span>
            </div>
          </Field>
          <div className="sm:col-span-2">
            <Button disabled={saveEscrow.isPending} onClick={() => saveEscrow.mutate()}>
              {saveEscrow.isPending ? "Saving..." : "Save payout settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="theme">
        <TabsList>
          <TabsTrigger value="theme">Theme</TabsTrigger>
          <TabsTrigger value="copy">Copy</TabsTrigger>
          <TabsTrigger value="rules">Booking rules</TabsTrigger>
          <TabsTrigger value="layout">Layout</TabsTrigger>
        </TabsList>

        <TabsContent value="theme">
          <JsonConfigEditor
            title="theme_json"
            description="Colors, font, mode, card style. Live-applied via CSS variables."
            value={config.theme_json}
            saving={saveJson.isPending}
            onSave={(v) => saveJson.mutate({ key: "theme_json", value: v as object })}
          />
        </TabsContent>
        <TabsContent value="copy">
          <CopyEditor
            copy={config.copy_json}
            copyAr={config.copy_json_ar ?? null}
            saving={saveJson.isPending}
            onSaveEn={(v) => saveJson.mutate({ key: "copy_json", value: v })}
            onSaveAr={(v) => saveJson.mutate({ key: "copy_json_ar", value: v })}
          />
        </TabsContent>
        <TabsContent value="rules">
          <JsonConfigEditor
            title="booking_rules_json"
            description="Validation, slot duration, advance window, cancellation."
            value={config.booking_rules_json}
            saving={saveJson.isPending}
            onSave={(v) => saveJson.mutate({ key: "booking_rules_json", value: v as object })}
          />
        </TabsContent>
        <TabsContent value="layout">
          <JsonConfigEditor
            title="layout_json"
            description="Toggle landing-page sections (testimonials, staff, services preview)."
            value={config.layout_json}
            saving={saveJson.isPending}
            onSave={(v) => saveJson.mutate({ key: "layout_json", value: v as object })}
          />
        </TabsContent>
      </Tabs>
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

// ---------------------------------------------------------------------------
// Copy editor — structured form for the 4 keys customer pages read from
// copy_json (heroTitle / heroSubtitle / ctaText / confirmationMessage) with
// paired Arabic inputs that write to copy_json_ar. Replaces the previous raw
// JSON textarea so vendors can localise their hero copy without writing
// JSON, and so the Arabic side actually has a UI.
// ---------------------------------------------------------------------------

interface CopyEditorProps {
  copy: CopyJson;
  copyAr: Partial<CopyJson> | null;
  saving: boolean;
  onSaveEn: (value: CopyJson) => void;
  onSaveAr: (value: Partial<CopyJson>) => void;
}

const COPY_FIELDS: { key: keyof CopyJson; label: string; textarea?: boolean }[] = [
  { key: "heroTitle", label: "Hero title" },
  { key: "heroSubtitle", label: "Hero subtitle", textarea: true },
  { key: "ctaText", label: "Primary CTA" },
  { key: "confirmationMessage", label: "Confirmation message", textarea: true },
];

function CopyEditor({ copy, copyAr, saving, onSaveEn, onSaveAr }: CopyEditorProps) {
  const [en, setEn] = useState<CopyJson>(copy);
  const [ar, setAr] = useState<Partial<CopyJson>>(copyAr ?? {});

  function set<K extends keyof CopyJson>(side: "en" | "ar", key: K, value: string) {
    if (side === "en") setEn((prev) => ({ ...prev, [key]: value }));
    else setAr((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Copy</CardTitle>
        <CardDescription>
          Hero, CTAs, and confirmation messaging. Arabic translations are
          optional — the Arabic site falls back to the English value per field
          when a translation is missing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {COPY_FIELDS.map((f) => (
          <div key={f.key} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{f.label} (English)</Label>
              {f.textarea ? (
                <Textarea
                  value={en[f.key] ?? ""}
                  onChange={(e) => set("en", f.key, e.target.value)}
                />
              ) : (
                <Input
                  value={en[f.key] ?? ""}
                  onChange={(e) => set("en", f.key, e.target.value)}
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{f.label} (العربية)</Label>
              {f.textarea ? (
                <Textarea
                  dir="rtl"
                  value={ar[f.key] ?? ""}
                  onChange={(e) => set("ar", f.key, e.target.value)}
                  placeholder="ترجمة عربية اختيارية"
                />
              ) : (
                <Input
                  dir="rtl"
                  value={ar[f.key] ?? ""}
                  onChange={(e) => set("ar", f.key, e.target.value)}
                  placeholder="ترجمة عربية اختيارية"
                />
              )}
            </div>
          </div>
        ))}
        <div className="flex justify-end">
          <Button
            disabled={saving}
            onClick={() => {
              onSaveEn(en);
              // Strip empty AR fields so we don't ship blanks that override
              // the English fallback unnecessarily.
              const arPayload: Partial<CopyJson> = {};
              for (const [k, v] of Object.entries(ar)) {
                if (typeof v === "string" && v.trim()) arPayload[k as keyof CopyJson] = v;
              }
              onSaveAr(arPayload);
            }}
          >
            {saving ? "Saving…" : "Save copy"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
