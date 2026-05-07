import { useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, Lock, Loader2, ExternalLink, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PaymentBrandMark } from "./PaymentBrandMark";
import {
  detectCardBrand,
  formatCardNumber,
  formatExpiry,
  PAYMENT_METHODS,
  type PaymentMethodId,
  type PaymentRequest,
} from "@/lib/payments";
import { formatCurrency } from "@/lib/utils";

interface Props {
  method: PaymentMethodId;
  amount: number;
  currency: string;
  reference: string;
  submitting: boolean;
  onSubmit: (req: PaymentRequest) => void;
}

export function PaymentForm({ method, amount, currency, reference, submitting, onSubmit }: Props) {
  if (method === "visa") {
    return <CardForm amount={amount} currency={currency} reference={reference} submitting={submitting} onSubmit={onSubmit} />;
  }
  if (method === "knet" || method === "paypal") {
    return (
      <RedirectMethod
        method={method}
        amount={amount}
        currency={currency}
        reference={reference}
        submitting={submitting}
        onSubmit={onSubmit}
      />
    );
  }
  return (
    <WalletMethod
      method={method}
      amount={amount}
      currency={currency}
      reference={reference}
      submitting={submitting}
      onSubmit={onSubmit}
    />
  );
}

// ---------------------------------------------------------------------------
// Card form (Visa / MC)
// ---------------------------------------------------------------------------

function CardForm({
  amount,
  currency,
  reference,
  submitting,
  onSubmit,
}: Omit<Props, "method">) {
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [holder, setHolder] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const brand = detectCardBrand(number);

  function validate() {
    const e: Record<string, string> = {};
    if (number.replace(/\D/g, "").length < 12) e.number = "Enter a valid card number";
    if (!/^\d{2}\/\d{2}$/.test(expiry)) e.expiry = "Format MM/YY";
    if (!/^\d{3,4}$/.test(cvc)) e.cvc = "3 or 4 digits";
    if (holder.trim().length < 2) e.holder = "Cardholder name required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    const [m, y] = expiry.split("/");
    onSubmit({
      method: "visa",
      amount,
      currency,
      reference,
      card: { number, expMonth: m, expYear: y, cvc, holder },
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-card/40 p-5">
        <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            Secure payment
          </span>
          <span className="font-mono text-[10px]">{reference}</span>
        </div>

        <div className="space-y-3">
          <Field label="Card number" error={errors.number}>
            <div className="relative">
              <Input
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="1234 5678 9012 3456"
                value={number}
                onChange={(e) => setNumber(formatCardNumber(e.target.value))}
                className="pr-16 font-mono tracking-wide"
              />
              <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                {brand !== "unknown" && (
                  <PaymentBrandMark method="visa" className="h-7 w-12" />
                )}
              </div>
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Expiry" error={errors.expiry}>
              <Input
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/YY"
                value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                className="font-mono"
              />
            </Field>
            <Field label="CVC" error={errors.cvc}>
              <Input
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="123"
                value={cvc}
                onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="font-mono"
              />
            </Field>
          </div>

          <Field label="Cardholder name" error={errors.holder}>
            <Input
              autoComplete="cc-name"
              placeholder="Name as printed on card"
              value={holder}
              onChange={(e) => setHolder(e.target.value)}
            />
          </Field>
        </div>
      </div>

      <SubmitButton submitting={submitting}>
        <CreditCard className="h-4 w-4" />
        Pay {formatCurrency(amount, currency)}
      </SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Wallets — Apple, Google, Samsung Pay
// ---------------------------------------------------------------------------

function WalletMethod({
  method,
  amount,
  currency,
  reference,
  submitting,
  onSubmit,
}: Props) {
  const m = PAYMENT_METHODS[method];
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-card/40 p-6 text-center">
        <PaymentBrandMark method={method} className="mx-auto h-12 w-20" />
        <h3 className="mt-4 text-base font-semibold">{m.label}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-background/50 px-3 py-1 text-xs">
          <Fingerprint className="h-3.5 w-3.5" />
          Confirm with biometrics on device
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          Reference <span className="font-mono">{reference}</span>
        </div>
      </div>
      <SubmitButton
        submitting={submitting}
        onClick={() => onSubmit({ method, amount, currency, reference })}
      >
        <PaymentBrandMark method={method} className="h-7 w-12" />
        Pay {formatCurrency(amount, currency)}
      </SubmitButton>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Redirect — PayPal, Knet
// ---------------------------------------------------------------------------

function RedirectMethod({
  method,
  amount,
  currency,
  reference,
  submitting,
  onSubmit,
}: Props) {
  const m = PAYMENT_METHODS[method];
  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-gradient-to-br from-card to-card/40 p-6"
      >
        <div className="flex items-center justify-between">
          <PaymentBrandMark method={method} className="h-10 w-16" />
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Redirect
          </span>
        </div>
        <h3 className="mt-4 text-base font-semibold">{m.label}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {method === "paypal"
            ? "You'll be taken to PayPal to log in and confirm the payment, then returned here."
            : "You'll be taken to your Knet bank portal to authorise the payment, then returned here."}
        </p>
        <div className="mt-4 grid gap-2 text-xs">
          <Row k="Amount" v={formatCurrency(amount, currency)} />
          <Row k="Merchant reference" v={reference} mono />
        </div>
      </motion.div>
      <SubmitButton
        submitting={submitting}
        onClick={() => onSubmit({ method, amount, currency, reference })}
      >
        <ExternalLink className="h-4 w-4" />
        Continue to {m.shortLabel}
      </SubmitButton>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-1.5 last:border-none">
      <span className="text-muted-foreground">{k}</span>
      <span className={mono ? "font-mono" : "font-medium"}>{v}</span>
    </div>
  );
}

function SubmitButton({
  submitting,
  children,
  onClick,
}: {
  submitting: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      size="lg"
      className="w-full"
      disabled={submitting}
    >
      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </Button>
  );
}
