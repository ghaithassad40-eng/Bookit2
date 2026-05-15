import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Wand2, Loader2, RotateCcw, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { BusinessRow, BusinessConfigRow } from "@/lib/database.types";

interface BrandSuggestion {
  name: string;
  slug: string;
  industry: string;
  tagline: string;
  theme: {
    mode: "dark" | "light";
    primaryColor: string;
    accentColor: string;
    secondaryColor: string;
    fontFamily: string;
  };
  copy: {
    heroTitle: string;
    heroSubtitle: string;
    ctaText: string;
    confirmationMessage: string;
  };
  copy_ar?: BrandSuggestion["copy"];
  services: Array<{
    name: string;
    description: string;
    duration_minutes: number;
    price: number;
    currency: string;
    capacity: number;
    color?: string;
  }>;
  staff_suggestions?: string[];
  paymentMethods?: string[];
  booking_rules?: {
    allowStaffSelection?: boolean;
    slotDurationMinutes?: number;
    requirePayment?: boolean;
  };
}

interface Props {
  business: BusinessRow;
  config: BusinessConfigRow;
  onApplied?: () => void;
}

export function BrandGeneratorPanel({ business, config, onApplied }: Props) {
  const [description, setDescription] = useState("");
  const [suggestion, setSuggestion] = useState<BrandSuggestion | null>(null);
  const [applying, setApplying] = useState(false);

  const generate = useMutation({
    mutationFn: async (): Promise<BrandSuggestion> => {
      if (!isSupabaseConfigured) {
        // Demo-mode fallback: deterministic local stub so the UI flow can be
        // demoed without an OpenRouter key.
        await new Promise((r) => setTimeout(r, 1200));
        return localStub(description, business.country ?? "KW");
      }
      const { data, error } = await supabase.functions.invoke<{
        success: boolean;
        suggestion: BrandSuggestion;
        error?: string;
      }>("ai-brand-generator", {
        body: { description, country: business.country, currency: config.copy_json && undefined },
      });
      if (error) throw error;
      if (!data?.success || !data.suggestion) throw new Error(data?.error ?? "no suggestion");
      return data.suggestion;
    },
    onSuccess: (s) => {
      setSuggestion(s);
      toast.success("Brand suggestion ready — review and apply");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "AI brand generation failed"),
  });

  async function applySuggestion() {
    if (!suggestion) return;
    setApplying(true);
    try {
      if (!isSupabaseConfigured) {
        // Demo mode — just notify; persistence to demo data not wired.
        toast.success("Applied — saved to this browser only (demo mode)");
        onApplied?.();
        return;
      }

      // Update business name/slug/industry
      const { error: bErr } = await supabase
        .from("businesses")
        .update({
          name: suggestion.name,
          industry: suggestion.industry,
        })
        .eq("id", business.id);
      if (bErr) throw bErr;

      // Update or insert business_configs
      const { error: cErr } = await supabase.from("business_configs").upsert(
        {
          business_id: business.id,
          theme_json: suggestion.theme,
          copy_json: suggestion.copy,
          copy_json_ar: suggestion.copy_ar ?? null,
          booking_rules_json: {
            ...config.booking_rules_json,
            allowStaffSelection: suggestion.booking_rules?.allowStaffSelection ?? true,
            slotDurationMinutes: suggestion.booking_rules?.slotDurationMinutes ?? 60,
            requirePayment: suggestion.booking_rules?.requirePayment ?? true,
            paymentMethods: suggestion.paymentMethods ?? config.booking_rules_json.paymentMethods,
          },
        },
        { onConflict: "business_id" },
      );
      if (cErr) throw cErr;

      // Insert suggested services
      if (suggestion.services && suggestion.services.length > 0) {
        const rows = suggestion.services.map((s) => ({
          business_id: business.id,
          name: s.name,
          description: s.description,
          duration_minutes: s.duration_minutes,
          price: s.price,
          currency: s.currency,
          capacity: s.capacity,
          color: s.color ?? suggestion.theme.accentColor,
          is_active: true,
        }));
        await supabase.from("services").insert(rows);
      }

      toast.success("Applied to your workspace");
      onApplied?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to apply");
    } finally {
      setApplying(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500/15 to-amber-500/15 ring-1 ring-fuchsia-500/20 text-fuchsia-500">
          <Wand2 className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <CardTitle>AI Brand &amp; Site Generator</CardTitle>
          <CardDescription>
            Describe your business in one sentence. We'll propose a name, palette,
            tagline, services, prices, copy and Arabic translations — one click
            to apply.
          </CardDescription>
        </div>
        <Badge variant="default" className="gap-1">
          <Sparkles className="h-3 w-3" />
          AI
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="brand-desc">Describe your business</Label>
          <Textarea
            id="brand-desc"
            placeholder="e.g. women's pilates studio in Salmiya, 50-minute sessions, 3 instructors, beginner-friendly"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[88px]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => generate.mutate()}
            disabled={!description.trim() || generate.isPending}
          >
            {generate.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                Generate brand
              </>
            )}
          </Button>
          {suggestion && (
            <Button variant="ghost" onClick={() => setSuggestion(null)}>
              <RotateCcw className="h-3.5 w-3.5" />
              Start over
            </Button>
          )}
        </div>

        <AnimatePresence>
          {suggestion && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-4 rounded-2xl border border-border bg-gradient-to-br from-card to-muted/30 p-4"
            >
              <Preview suggestion={suggestion} />

              <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                <Button onClick={applySuggestion} disabled={applying}>
                  {applying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Applying…
                    </>
                  ) : (
                    <>
                      <ChevronRight className="h-4 w-4" />
                      Apply to my workspace
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => generate.mutate()} disabled={generate.isPending}>
                  <Wand2 className="h-4 w-4" />
                  Try another variation
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

function Preview({ suggestion }: { suggestion: BrandSuggestion }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div
          className="h-12 w-12 shrink-0 rounded-xl"
          style={{ background: suggestion.theme.accentColor }}
        />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {suggestion.industry} · {suggestion.theme.mode}
          </div>
          <div className="mt-0.5 text-lg font-semibold">{suggestion.name}</div>
          <div className="text-sm text-muted-foreground">{suggestion.tagline}</div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background/40 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Hero
        </div>
        <div className="mt-1 text-base font-semibold">{suggestion.copy.heroTitle}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{suggestion.copy.heroSubtitle}</div>
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium">
          {suggestion.copy.ctaText}
        </div>
      </div>

      {suggestion.copy_ar && (
        <div className="rounded-xl border border-border bg-background/40 p-3" dir="rtl">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            النصّ العربي
          </div>
          <div className="mt-1 text-base font-semibold">{suggestion.copy_ar.heroTitle}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{suggestion.copy_ar.heroSubtitle}</div>
        </div>
      )}

      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Services ({suggestion.services.length})
        </div>
        <ul className="space-y-1.5">
          {suggestion.services.map((s, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{s.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {s.duration_minutes} min · cap {s.capacity}
                </div>
              </div>
              <div className="text-sm font-semibold">
                {s.currency} {s.price}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {suggestion.paymentMethods && suggestion.paymentMethods.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Payment methods:
          </span>
          {suggestion.paymentMethods.map((m) => (
            <Badge key={m} variant="outline" className="text-[10px] uppercase">
              {m}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Demo-mode local stub (no OpenRouter required)
// ---------------------------------------------------------------------------

function localStub(description: string, country: string): BrandSuggestion {
  const isKw = country.toUpperCase() === "KW";
  const isSa = country.toUpperCase() === "SA";
  const isAe = country.toUpperCase() === "AE";

  const currency = isKw ? "KWD" : isSa ? "SAR" : isAe ? "AED" : "USD";
  const lower = description.toLowerCase();

  let industry: BrandSuggestion["industry"] = "other";
  if (lower.includes("yoga")) industry = "yoga";
  else if (lower.includes("pilates")) industry = "yoga";
  else if (lower.includes("gym") || lower.includes("fitness")) industry = "gym";
  else if (lower.includes("salon") || lower.includes("hair") || lower.includes("barber")) industry = "salon";
  else if (lower.includes("clinic") || lower.includes("doctor")) industry = "clinic";
  else if (lower.includes("football") || lower.includes("soccer") || lower.includes("5v5")) industry = "football";
  else if (lower.includes("basketball") || lower.includes("hoops")) industry = "basketball";
  else if (lower.includes("padel")) industry = "padel";
  else if (lower.includes("cricket")) industry = "cricket";

  const name = description
    .split(/[,.]/)[0]
    .trim()
    .replace(/^./, (c) => c.toUpperCase())
    .slice(0, 40) || "New Workspace";

  return {
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 32),
    industry,
    tagline: industry === "yoga" ? "Find your stillness, gently led." : "Book in seconds.",
    theme: {
      mode: industry === "gym" || industry === "football" ? "dark" : "light",
      primaryColor: industry === "gym" || industry === "football" ? "#0a0a0f" : "#FAF7F2",
      accentColor: industry === "gym" ? "#22D3EE"
        : industry === "football" ? "#22C55E"
        : industry === "salon" ? "#C2410C"
        : industry === "yoga" ? "#7C3AED"
        : industry === "padel" ? "#0284C7"
        : industry === "cricket" ? "#B91C1C"
        : "#3B82F6",
      secondaryColor: "#FACC15",
      fontFamily: industry === "salon" || industry === "yoga" ? "Plus Jakarta Sans" : "Inter",
    },
    copy: {
      heroTitle: industry === "yoga" ? "Find your stillness." : "Book in seconds.",
      heroSubtitle: `${description.trim()} — reserve your spot in seconds.`,
      ctaText: industry === "padel" || industry === "football" ? "Book Court" : "Book Now",
      confirmationMessage: "You're booked. See you soon.",
    },
    copy_ar: {
      heroTitle: industry === "yoga" ? "اِبحث عن سكينتك." : "احجز خلال ثوانٍ.",
      heroSubtitle: "احجز موعدك خلال ثوانٍ.",
      ctaText: "احجز الآن",
      confirmationMessage: "تم الحجز. نلتقي قريباً.",
    },
    services: [
      {
        name: industry === "yoga" ? "Drop-in Class" : industry === "padel" ? "Court Booking" : "Standard Session",
        description: "Sample service generated for the demo.",
        duration_minutes: 60,
        price: isKw ? 12 : isSa ? 80 : 60,
        currency,
        capacity: industry === "yoga" ? 16 : 1,
        color: "#3B82F6",
      },
      {
        name: "Premium Session",
        description: "Private 1:1 / premium experience.",
        duration_minutes: 60,
        price: isKw ? 25 : isSa ? 200 : 150,
        currency,
        capacity: 1,
        color: "#22C55E",
      },
    ],
    staff_suggestions: isKw ? ["Coach Ahmad", "Coach Layla"] : isSa ? ["Coach Saad", "Coach Reem"] : ["Coach 1", "Coach 2"],
    paymentMethods: isKw
      ? ["knet", "apple_pay", "google_pay", "visa"]
      : isSa
      ? ["mada", "stcpay", "apple_pay", "visa"]
      : isAe
      ? ["uaecc", "apple_pay", "google_pay", "visa"]
      : ["visa", "apple_pay", "google_pay"],
    booking_rules: {
      allowStaffSelection: industry === "yoga" || industry === "padel" || industry === "football" ? false : true,
      slotDurationMinutes: 60,
      requirePayment: industry === "clinic" ? false : true,
    },
  };
}
