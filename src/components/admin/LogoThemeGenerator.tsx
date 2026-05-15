import { useRef, useState } from "react";
import { Loader2, Sparkles, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  extractPalette,
  fileToDataUrl,
  loadImage,
  pickThemeFromPalette,
  type ThemeSuggestion,
} from "@/lib/colorExtractor";
import type { ThemeJson } from "@/lib/database.types";
import { useI18n } from "@/hooks/useI18n";

interface Props {
  /** Current theme so we can preserve fields the extractor doesn't touch
   *  (fontFamily, borderRadius, cardStyle, animationStyle). */
  current: ThemeJson;
  /** Called with the merged theme + (optional) logo data URL when the
   *  vendor clicks "Apply". The host page wires this to the existing
   *  theme_json save mutation + the business.logo_url update. */
  onApply: (next: ThemeJson, logoDataUrl: string | null) => void;
  busy?: boolean;
}

interface AnalysisState {
  logoDataUrl: string;
  suggestion: ThemeSuggestion;
}

/**
 * Drop-zone + file picker that turns a vendor's uploaded logo into a
 * theme palette suggestion. Pure client-side colour analysis (see
 * src/lib/colorExtractor.ts) wrapped in an "AI-suggested" UX flow —
 * brief analysing spinner, palette preview swatches, role labels for
 * each picked colour, then an explicit Apply step so nothing changes
 * until the vendor opts in.
 */
export function LogoThemeGenerator({ current, onApply, busy = false }: Props) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [analysing, setAnalysing] = useState(false);
  const [state, setState] = useState<AnalysisState | null>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error(t("admin.theme.toast.notImage"));
      return;
    }
    // Soft cap at 8 MB — anything bigger is almost certainly a mistake
    // (a logo doesn't need to be 20MB) and would slow down the canvas pass.
    if (file.size > 8 * 1024 * 1024) {
      toast.error(t("admin.theme.toast.tooLarge"));
      return;
    }
    setAnalysing(true);
    try {
      // Short artificial delay so the analysing state is actually visible
      // — looks intentional rather than "did anything happen?" on fast
      // machines. ~500ms total feels deliberate but never sluggish.
      const [dataUrl, img] = await Promise.all([
        fileToDataUrl(file),
        loadImage(file),
        new Promise((r) => setTimeout(r, 450)),
      ]).then(([d, i]) => [d, i] as [string, HTMLImageElement]);

      const palette = extractPalette(img, 6);
      const suggestion = pickThemeFromPalette(palette);
      setState({ logoDataUrl: dataUrl, suggestion });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("admin.theme.toast.failed"));
    } finally {
      setAnalysing(false);
    }
  }

  function handleApply() {
    if (!state) return;
    const next: ThemeJson = {
      ...current,
      mode: state.suggestion.mode,
      primaryColor: state.suggestion.primaryColor,
      accentColor: state.suggestion.accentColor,
      secondaryColor: state.suggestion.secondaryColor,
    };
    onApply(next, state.logoDataUrl);
    toast.success(t("admin.theme.toast.applied"));
  }

  function reset() {
    setState(null);
  }

  function onDrop(ev: React.DragEvent) {
    ev.preventDefault();
    const file = ev.dataTransfer?.files?.[0];
    if (file) void handleFile(file);
  }

  function onDragOver(ev: React.DragEvent) {
    ev.preventDefault();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-navy/15 to-brand-gold/20 text-brand-gold">
          <Wand2 className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <CardTitle className="flex items-center gap-2">
            {t("admin.theme.generator.title")}
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Sparkles className="h-3 w-3" />
              {t("admin.theme.generator.aiBadge")}
            </Badge>
          </CardTitle>
          <CardDescription>{t("admin.theme.generator.subtitle")}</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!state && !analysing && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDrop={onDrop}
            onDragOver={onDragOver}
            className="group flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/30 px-6 py-10 text-center transition-colors hover:border-accent/60 hover:bg-accent/5"
          >
            <div className="grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent transition-transform group-hover:scale-110">
              <Upload className="h-5 w-5" />
            </div>
            <div className="text-sm font-medium">
              {t("admin.theme.generator.dropTitle")}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("admin.theme.generator.dropHint")}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                // Reset value so picking the same file again re-fires.
                e.target.value = "";
              }}
            />
          </button>
        )}

        {analysing && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-muted/30 px-6 py-10 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-accent/10">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
            </div>
            <div className="text-sm font-medium">
              {t("admin.theme.generator.analysing")}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("admin.theme.generator.analysingHint")}
            </div>
          </div>
        )}

        {state && !analysing && (
          <div className="space-y-4">
            {/* Logo preview + extracted palette */}
            <div className="flex flex-col items-stretch gap-4 sm:flex-row">
              <div className="flex shrink-0 items-center justify-center rounded-xl border border-border bg-white p-3 sm:w-32">
                <img
                  src={state.logoDataUrl}
                  alt=""
                  className="max-h-24 max-w-full object-contain"
                />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {t("admin.theme.generator.paletteFound")}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {state.suggestion.palette.map((c) => (
                      <div key={c.hex} className="flex flex-col items-center gap-1">
                        <div
                          className="h-9 w-9 rounded-lg border border-border shadow-sm"
                          style={{ backgroundColor: c.hex }}
                          title={c.hex}
                        />
                        <span className="font-mono text-[9px] text-muted-foreground">
                          {c.hex}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Smart-pick role assignment */}
            <div className="grid gap-2 rounded-xl border border-border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-4">
              <SwatchRow
                label={t("admin.theme.generator.role.primary")}
                hex={state.suggestion.primaryColor}
              />
              <SwatchRow
                label={t("admin.theme.generator.role.accent")}
                hex={state.suggestion.accentColor}
              />
              <SwatchRow
                label={t("admin.theme.generator.role.secondary")}
                hex={state.suggestion.secondaryColor}
              />
              <SwatchRow
                label={t("admin.theme.generator.role.mode")}
                value={state.suggestion.mode}
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={reset} disabled={busy}>
                {t("admin.theme.generator.tryAnother")}
              </Button>
              <Button onClick={handleApply} disabled={busy}>
                <Wand2 className="h-4 w-4" />
                {t("admin.theme.generator.apply")}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SwatchRow({
  label,
  hex,
  value,
}: {
  label: string;
  hex?: string;
  value?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {hex ? (
        <div
          className="h-7 w-7 shrink-0 rounded-md border border-border shadow-sm"
          style={{ backgroundColor: hex }}
        />
      ) : (
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border bg-card text-[10px] font-semibold uppercase">
          {value?.charAt(0)}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="font-mono text-xs">{hex ?? value}</div>
      </div>
    </div>
  );
}
