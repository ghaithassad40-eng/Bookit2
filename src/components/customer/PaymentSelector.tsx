import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { PAYMENT_METHODS, type PaymentMethodId } from "@/lib/payments";
import { PaymentBrandMark } from "./PaymentBrandMark";
import { cn } from "@/lib/utils";

interface Props {
  enabled: PaymentMethodId[];
  value: PaymentMethodId | null;
  onChange: (id: PaymentMethodId) => void;
}

export function PaymentSelector({ enabled, value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {enabled.map((id) => {
        const method = PAYMENT_METHODS[id];
        const selected = value === id;
        return (
          <motion.button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "relative flex h-[88px] flex-col items-center justify-center gap-2 rounded-xl border bg-card/50 p-2 text-center transition-all",
              selected
                ? "border-accent ring-2 ring-accent/40"
                : "border-border hover:border-accent/40",
            )}
          >
            <PaymentBrandMark method={id} />
            <span className="text-[11px] font-medium leading-tight text-foreground/80">
              {method.shortLabel}
            </span>
            {selected && (
              <motion.span
                layoutId="payment-selected"
                className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-accent text-accent-foreground"
              >
                <Check className="h-3 w-3" />
              </motion.span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
