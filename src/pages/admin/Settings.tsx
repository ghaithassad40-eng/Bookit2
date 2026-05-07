import { useOutletContext } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { BusinessRow, BusinessConfigRow } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JsonConfigEditor } from "@/components/admin/JsonConfigEditor";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface Ctx {
  business: BusinessRow;
  config: BusinessConfigRow;
}

type ConfigKey =
  | "theme_json"
  | "copy_json"
  | "booking_rules_json"
  | "layout_json";

export default function Settings() {
  const { business, config } = useOutletContext<Ctx>();
  const qc = useQueryClient();
  const [name, setName] = useState(business.name);
  const [slug, setSlug] = useState(business.slug);
  const [logoUrl, setLogoUrl] = useState(business.logo_url ?? "");

  const updateBusiness = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("businesses")
        .update({ name, slug, logo_url: logoUrl || null })
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
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Tune branding, copy, and booking rules. Changes apply instantly across the customer experience.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Business profile</CardTitle>
          <CardDescription>Public-facing identity for /business/{business.slug}.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Field label="Display name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
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
          <JsonConfigEditor
            title="copy_json"
            description="Hero, CTAs, confirmation messaging."
            value={config.copy_json}
            saving={saveJson.isPending}
            onSave={(v) => saveJson.mutate({ key: "copy_json", value: v as object })}
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
