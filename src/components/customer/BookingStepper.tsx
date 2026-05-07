import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BookingStep } from "@/store/bookingStore";

const ALL_STEPS: { key: BookingStep; label: string }[] = [
  { key: "service", label: "Service" },
  { key: "staff", label: "Staff" },
  { key: "slot", label: "Slot" },
  { key: "details", label: "Details" },
  { key: "review", label: "Review" },
  { key: "payment", label: "Pay" },
];

interface Props {
  current: BookingStep;
  showStaff?: boolean;
}

export function BookingStepper({ current, showStaff = true }: Props) {
  const steps = showStaff ? ALL_STEPS : ALL_STEPS.filter((s) => s.key !== "staff");
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
              {step.label}
            </span>
            {i < steps.length - 1 && <span className="mx-2 h-px w-6 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}
