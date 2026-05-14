import { Globe } from "lucide-react";
import { LOCALES, type Locale } from "@/lib/i18n";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/utils";

interface Props {
  variant?: "header" | "floating";
  className?: string;
}

const ORDER: Locale[] = ["en", "ar"];

export function LanguagePicker({ variant = "header", className }: Props) {
  const { locale, setLocale } = useI18n();

  if (variant === "floating") {
    return (
      <div
        className={cn(
          "fixed bottom-4 left-4 z-40 flex items-center gap-1 rounded-full border border-border bg-card/90 p-1 shadow-lg backdrop-blur-xl",
          className,
        )}
        data-no-print
      >
        <Globe className="ms-1 h-3.5 w-3.5 text-muted-foreground" />
        {ORDER.map((code) => {
          const meta = LOCALES[code];
          const active = code === locale;
          return (
            <button
              key={code}
              onClick={() => setLocale(code)}
              aria-pressed={active}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {meta.nativeLabel}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-1 rounded-full border border-border bg-card/60 p-0.5 text-xs", className)}>
      {ORDER.map((code) => {
        const meta = LOCALES[code];
        const active = code === locale;
        return (
          <button
            key={code}
            onClick={() => setLocale(code)}
            aria-pressed={active}
            className={cn(
              "rounded-full px-2.5 py-1 font-medium transition-colors",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {meta.nativeLabel}
          </button>
        );
      })}
    </div>
  );
}
