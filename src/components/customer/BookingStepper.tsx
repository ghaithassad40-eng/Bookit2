import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";
import type { BookingStep } from "@/store/bookingStore";
import type { TranslationKey } from "@/lib/i18n";

const STEP_KEYS: { key: BookingStep; i18nKey: TranslationKey }[] = [
  { key: "service", i18nKey: "step.service" },
  { key: "staff", i18nKey: "step.staff" },
  { key: "slot", i18nKey: "step.slot" },
  { key: "equipment", i18nKey: "step.equipment" },
  { key: "details", i18nKey: "step.details" },
  { key: "review", i18nKey: "step.review" },
  { key: "payment", i18nKey: "step.payment" },
];

interface Props {
  current: BookingStep;
  showStaff?: boolean;
  /** Hide the Equipment step entirely when the business has no add-ons. */
  showEquipment?: boolean;
}

export function BookingStepper({ current, showStaff = true, showEquipment = true }: Props) {
  const { t } = useI18n();
  const steps = STEP_KEYS.filter((s) => {
    if (s.key === "staff" && !showStaff) return false;
    if (s.key === "equipment" && !showEquipment) return false;
    return true;
  });
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
