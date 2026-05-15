import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Globe2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";
import { useRegion } from "@/hooks/useRegion";
import { COUNTRIES, detectCountry, type CountryCode } from "@/lib/region";
import { LOCALES, type Locale } from "@/lib/i18n";

interface Props {
  /** Force the modal open even after the user has chosen — used by the
   * header RegionPill to let them change country/language later. */
  open?: boolean;
  onClose?: () => void;
}

export function WelcomePicker({ open: openOverride, onClose }: Props) {
  const { isFirstVisit, country, setCountry } = useRegion();
  const { locale, setLocale, t } = useI18n();

  // Pre-fill from timezone detection on first visit, otherwise use stored value.
  const initialCountry: CountryCode =
    country ?? detectCountry() ?? "KW";

  const [pickedCountry, setPickedCountry] = useState<CountryCode>(initialCountry);
  const [pickedLocale, setPickedLocale] = useState<Locale>(locale);
  const [open, setOpen] = useState(false);

  // Drive open state from either explicit override or first-visit signal.
  useEffect(() => {
    if (openOverride !== undefined) {
      setOpen(openOverride);
      return;
    }
    if (isFirstVisit) {
      // Give the first paint a beat before showing the modal so it doesn't
      // flash on hard refresh.
      const id = window.setTimeout(() => setOpen(true), 220);
      return () => window.clearTimeout(id);
    }
  }, [openOverride, isFirstVisit]);

  function commit() {
    setCountry(pickedCountry);
    if (pickedLocale !== locale) setLocale(pickedLocale);
    setOpen(false);
    onClose?.();
  }

  function dismiss() {
    // Skip without choosing → store ALL so we don't ask again
    setCountry("ALL");
    setOpen(false);
    onClose?.();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] grid place-items-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", damping: 22, stiffness: 240 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            <button
              onClick={dismiss}
              aria-label="Close"
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="bg-gradient-to-br from-accent/10 via-card to-secondary/10 p-6 pb-5">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-400 text-white shadow-lg shadow-blue-500/25">
                <Sparkles className="h-5 w-5" />
              </div>
              <h2 className="mt-3 text-xl font-semibold tracking-tight">{t("welcome.title")}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{t("welcome.subtitle")}</p>
            </div>

            <div className="space-y-5 p-6 pt-4">
              {/* Language */}
              <div>
                <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  <Globe2 className="h-3.5 w-3.5" />
                  {t("welcome.language")}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(LOCALES) as Locale[]).map((code) => {
                    const meta = LOCALES[code];
                    const active = pickedLocale === code;
                    return (
                      <button
                        key={code}
                        onClick={() => setPickedLocale(code)}
                        className={cn(
                          "flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-medium transition-all",
                          active
                            ? "border-accent bg-accent/10 ring-2 ring-accent/30"
                            : "border-border hover:border-accent/40",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <span aria-hidden>{meta.flag}</span>
                          {meta.nativeLabel}
                        </span>
                        {active && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Country */}
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {t("welcome.country")}
                </div>
                <div className="grid max-h-[260px] grid-cols-2 gap-2 overflow-y-auto pr-1">
                  {COUNTRIES.map((c) => {
                    const active = pickedCountry === c.code;
                    return (
                      <button
                        key={c.code}
                        onClick={() => setPickedCountry(c.code)}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all",
                          active
                            ? "border-accent bg-accent/10 ring-2 ring-accent/30"
                            : "border-border hover:border-accent/40",
                        )}
                      >
                        <span className="text-base leading-none" aria-hidden>
                          {c.flag}
                        </span>
                        <span className="min-w-0 flex-1 text-start">
                          <span className="block truncate font-medium">
                            {pickedLocale === "ar" ? c.nameAr : c.name}
                          </span>
                          <span className="block text-[10px] font-mono text-muted-foreground">
                            {c.currency}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setPickedCountry("ALL")}
                  className={cn(
                    "mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium underline-offset-4 hover:underline",
                    pickedCountry === "ALL" ? "text-accent" : "text-muted-foreground",
                  )}
                >
                  🌍 {t("welcome.allCountries")}
                </button>
              </div>

              <p className="text-[11px] text-muted-foreground">{t("welcome.changeLater")}</p>

              <Button onClick={commit} className="w-full" size="lg">
                {t("welcome.continue")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
