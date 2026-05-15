import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";
import { useRegion } from "@/hooks/useRegion";
import { COUNTRIES, detectCountry, type CountryCode } from "@/lib/region";
import { LOCALES, type Locale } from "@/lib/i18n";
import { Flag } from "./Flag";

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
  const initialCountry: CountryCode = country ?? detectCountry() ?? "KW";

  const [pickedCountry, setPickedCountry] = useState<CountryCode>(initialCountry);
  const [pickedLocale, setPickedLocale] = useState<Locale>(locale);
  const [open, setOpen] = useState(false);
  // Capture the portal target after mount — `document.body` is not safely
  // accessible during initial render (SSR / early hydration / HMR can all
  // hit a transient null and trip a render-time createPortal error).
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(typeof document !== "undefined" ? document.body : null);
  }, []);

  // Drive open state from either explicit override or first-visit signal.
  useEffect(() => {
    if (openOverride !== undefined) {
      setOpen(openOverride);
      return;
    }
    if (isFirstVisit) {
      const id = window.setTimeout(() => setOpen(true), 220);
      return () => window.clearTimeout(id);
    }
  }, [openOverride, isFirstVisit]);

  // Lock body scroll + hide the page underneath while the modal is open so
  // the hero copy / CTAs behind it can't bleed through the backdrop.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

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

  if (!portalTarget) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-picker-title"
        >
          {/* Backdrop — near-opaque so the page underneath cannot bleed
              through the modal at any point. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={dismiss}
            className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", damping: 22, stiffness: 240 }}
            className="relative z-10 my-auto w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl dark:bg-slate-950"
          >
            {/* Hero band — solid brand colour, white text, guaranteed contrast */}
            <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-500 to-emerald-500 px-6 pb-7 pt-6 text-white">
              <button
                onClick={dismiss}
                aria-label="Close"
                className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 text-white shadow-lg shadow-black/10 ring-1 ring-white/30 backdrop-blur">
                <Sparkles className="h-5 w-5" />
              </div>

              <h2 id="welcome-picker-title" className="mt-4 text-2xl font-bold tracking-tight text-white">
                {t("welcome.title")}
              </h2>
              <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-white/85">
                {t("welcome.subtitle")}
              </p>

              {/* Decorative orbs */}
              <div
                aria-hidden
                className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-white/10 blur-2xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-16 right-8 h-24 w-24 rounded-full bg-white/10 blur-2xl"
              />
            </div>

            <div className="space-y-5 p-6">
              {/* Language */}
              <section>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
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
                          "group relative flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-medium transition-all",
                          active
                            ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20 dark:border-blue-400 dark:bg-blue-950/50 dark:text-blue-100"
                            : "border-slate-200 bg-white text-slate-800 hover:border-blue-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-blue-700 dark:hover:bg-slate-800/60",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-base" aria-hidden>
                            {code === "ar" ? "ع" : "A"}
                          </span>
                          <span>{meta.nativeLabel}</span>
                        </span>
                        {active && <Check className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Country */}
              <section>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  {t("welcome.country")}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {COUNTRIES.map((c) => {
                    const active = pickedCountry === c.code;
                    const label = pickedLocale === "ar" ? c.nameAr : c.name;
                    return (
                      <button
                        key={c.code}
                        onClick={() => setPickedCountry(c.code)}
                        className={cn(
                          "group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start transition-all",
                          active
                            ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20 dark:border-blue-400 dark:bg-blue-950/50"
                            : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700 dark:hover:bg-slate-800/60",
                        )}
                      >
                        <Flag code={c.code} className="shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block truncate text-sm font-semibold leading-tight",
                              active
                                ? "text-blue-700 dark:text-blue-100"
                                : "text-slate-900 dark:text-slate-100",
                            )}
                          >
                            {label}
                          </span>
                          <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            {c.currency}
                          </span>
                        </span>
                        {active && (
                          <Check className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>

              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {t("welcome.changeLater")}
              </p>

              <Button onClick={commit} className="w-full" size="lg">
                {t("welcome.continue")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalTarget,
  );
}
