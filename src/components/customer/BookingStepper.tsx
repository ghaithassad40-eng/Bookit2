import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";
import type { BookingStep } from "@/store/bookingStore";
import type { TranslationKey } from "@/lib/i18n";

const STEP_KEYS: { key: BookingStep; i18nKey: TranslationKey }[] = [
  { key: "service", i18nKey: "step.service" },
  { key: "staff", i18nKey: "step.staff" },
  { key: "slot", i18nKey: "step.slot" },
  { key: "details", i18nKey: "step.details" },
  { key: "review", i18nKey: "step.review" },
  { key: "payment", i18nKey: "step.payment" },
];

interface Props {
  current: BookingStep;
  showStaff?: boolean;
}

export function BookingStepper({ current, showStaff = true }: Props) {
  const { t } = useI18n();
  const steps = showStaff ? STEP_KEYS : STEP_KEYS.filter((s) => s.key !== "staff");
  const currentIndex = steps.findIndex((s) => s.key === current);

  return (
    <ol className="flex w-full items-center gap-2 overflow-x-auto pb-1">
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li key={step.key} className="flex shrink-0 items-center gap-2">
            <div
              className={cn(
                "grid h-7 w-7 place-items-center rounded-full border text-xs font-semibold transition-colors",
                done && "border-accent bg-accent text-accent-foreground",
                active && "border-accent text-accent",
                !done && !active && "border-border text-muted-foreground",
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-xs font-medium",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {t(step.i18nKey)}
            </span>
            {i < steps.length - 1 && <span className="mx-2 h-px w-6 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}
