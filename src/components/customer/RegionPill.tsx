import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { WelcomePicker } from "./WelcomePicker";
import { Flag } from "./Flag";
import { useRegion } from "@/hooks/useRegion";
import { useI18n } from "@/hooks/useI18n";
import { ALL_COUNTRY, countryMeta } from "@/lib/region";
import { cn } from "@/lib/utils";

/**
 * Compact pill in the customer site header showing the current country +
 * language. Tapping opens the WelcomePicker modal so the user can change.
 */
export function RegionPill({ className }: { className?: string }) {
  const { country } = useRegion();
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);

  const meta = country ? countryMeta(country) : ALL_COUNTRY;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-2.5 py-1.5 text-xs font-medium text-foreground/85 transition-colors hover:bg-card",
          className,
        )}
        aria-label="Change country or language"
      >
        <Flag code={meta.code} className="h-3.5 w-5" />
        <span className="hidden sm:inline">
          {locale === "ar" ? meta.nameAr : meta.name}
        </span>
        <span className="opacity-50">·</span>
        <span className="font-semibold uppercase tracking-wide">{locale}</span>
        <ChevronDown className="h-3 w-3 opacity-50" />
      </button>

      {open && <WelcomePicker open onClose={() => setOpen(false)} />}
    </>
  );
}
