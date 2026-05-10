import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Loader2, ShieldCheck, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { PaymentBrandMark } from "@/components/customer/PaymentBrandMark";
import { formatCurrency } from "@/lib/utils";
import {
  detectCardBrand,
  formatCardNumber,
  formatExpiry,
  isExpiryFuture,
  luhnValid,
  type PaymentMethodId,
} from "@/lib/payments";

/**
 * A mock of the MyFatoorah hosted payment page. This URL is hit when
 * VITE_MYFATOORAH_ENABLED is false — real MyFatoorah replaces this with their
 * own hosted page. We mirror the UX (single-page card form, branded chrome,
 * test-card hints) so the demo flow feels authentic.
 */
export default function MyFatoorahMock() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [number, setNumber] = useState("4005 5500 0000 0001");
  const [exp, setExp] = useState("12/29");
  const [cvc, setCvc] = useState("123");
  const [holder, setHolder] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"card" | "otp" | "processing">("card");
  const [error, setError] = useState<string | null>(null);

  const amount = parseFloat(params.get("amount") ?? "0");
  const currency = params.get("currency") ?? "USD";
  const reference = params.get("reference") ?? "";
  const invoiceId = params.get("invoiceId") ?? "";
  const method = (params.get("method") ?? "any") as PaymentMethodId | "any";
  const returnTo = params.get("returnTo") ?? "/";

  const brand = detectCardBrand(number);

  function returnWithStatus(approved: boolean) {
    window.localStorage.setItem(`bookit.demo.mf.${reference}`, approved ? "approved" : "declined");
    const url = new URL(returnTo, window.location.origin);
    url.searchParams.set("paymentId", `MFTEST-${invoiceId}`);
    url.searchParams.set("Id", invoiceId);
    if (!approved) url.searchParams.set("error", "1");
    navigate(url.pathname + url.search, { replace: true });
  }

  function handleAuthorize() {
    setError(null);
    if (!luhnValid(number)) return setError("Card number invalid");
    const [m, y] = exp.split("/");
    if (!isExpiryFuture(m, y)) return setError("Card expired");
    if (!/^\d{3,4}$/.test(cvc)) return setError("CVC must be 3-4 digits");
    if (holder.trim().length < 2) return setError("Cardholder name required");
    setStage("otp");
  }

  function handleVerify() {
    if (otp !== "1234") return setError("Invalid OTP. Test OTP is 1234");
    setStage("processing");
    setTimeout(() => returnWithStatus(true), 1100);
  }

  return (
    <div className="min-h-screen bg-[#f4f6fb] text-slate-900">
      {/* MyFatoorah-style header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-[#0E3A8A] to-[#15a4d6] text-[10px] font-bold text-white">
              MF
            </div>
            <span className="text-sm font-semibold tracking-tight">MyFatoorah</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
              Staging
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Lock className="h-3.5 w-3.5" /> Secure
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <button
          onClick={() => returnWithStatus(false)}
          className="mb-4 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Cancel and return
        </button>

        <div className="grid gap-6 md:grid-cols-[1fr_280px]">
          <div>
            {stage === "card" && (
              <Card className="border-slate-200 bg-white">
                <CardContent className="space-y-4 pt-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold">Pay with card</h2>
                    {brand !== "unknown" && (
                      <PaymentBrandMark method={method === "knet" ? "knet" : "visa"} className="h-7 w-12" />
                    )}
                  </div>

                  <Field label="Card number" error={error?.startsWith("Card number") ? error : undefined}>
                    <Input
                      inputMode="numeric"
                      value={number}
                      onChange={(e) => setNumber(formatCardNumber(e.target.value))}
                      className="border-slate-200 bg-white font-mono"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Expiry" error={error?.startsWith("Card expired") ? error : undefined}>
                      <Input
                        inputMode="numeric"
                        value={exp}
                        onChange={(e) => setExp(formatExpiry(e.target.value))}
                        className="border-slate-200 bg-white font-mono"
                      />
                    </Field>
                    <Field label="CVC" error={error?.startsWith("CVC") ? error : undefined}>
                      <Input
                        inputMode="numeric"
                        value={cvc}
                        onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        className="border-slate-200 bg-white font-mono"
                      />
                    </Field>
                  </div>
                  <Field label="Cardholder name" error={error?.startsWith("Cardholder") ? error : undefined}>
                    <Input
                      value={holder}
                      onChange={(e) => setHolder(e.target.value)}
                      placeholder="Name as printed on card"
                      className="border-slate-200 bg-white"
                    />
                  </Field>

                  <Button
                    className="w-full bg-[#0E3A8A] text-white hover:bg-[#102f6f]"
                    size="lg"
                    onClick={handleAuthorize}
                  >
                    Authorize {formatCurrency(amount, currency)}
                  </Button>

                  <p className="rounded-lg bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800">
                    <strong>Test cards:</strong>
                    {" "}KNET: <span className="font-mono">8888 8888 0000 0001</span>{" "}
                    · Visa: <span className="font-mono">4005 5500 0000 0001</span>{" "}
                    (any future expiry, any CVC, OTP <span className="font-mono">1234</span>).
                  </p>
                </CardContent>
              </Card>
            )}

            {stage === "otp" && (
              <Card className="border-slate-200 bg-white">
                <CardContent className="space-y-4 pt-6 text-center">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-blue-100 text-blue-700">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold">Verify with your bank</h2>
                    <p className="mt-1 text-xs text-slate-600">
                      We've sent a 4-digit code to your phone. Enter it to authorise the payment.
                    </p>
                  </div>
                  <Input
                    inputMode="numeric"
                    maxLength={4}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="1234"
                    className="mx-auto w-40 border-slate-200 bg-white text-center font-mono text-xl tracking-[0.4em]"
                  />
                  {error && <p className="text-xs text-rose-600">{error}</p>}
                  <Button
                    className="w-full bg-[#0E3A8A] text-white hover:bg-[#102f6f]"
                    size="lg"
                    onClick={handleVerify}
                  >
                    Verify and pay
                  </Button>
                </CardContent>
              </Card>
            )}

            {stage === "processing" && (
              <Card className="border-slate-200 bg-white">
                <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  <p className="text-sm text-slate-600">Processing… do not close this window.</p>
                </CardContent>
              </Card>
            )}
          </div>

          <aside className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Order summary</h3>
            <Row k="Amount" v={formatCurrency(amount, currency)} />
            <Row k="Currency" v={currency} />
            <Row k="Reference" v={reference} mono />
            <Row k="Invoice" v={invoiceId} mono />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="rounded-lg bg-slate-50 p-3 text-[11px] text-slate-600"
            >
              You're on a <strong>staging</strong> environment. No real money will move.
            </motion.div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-slate-700">{label}</Label>
      {children}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-1.5 last:border-none">
      <span className="text-slate-500">{k}</span>
      <span className={mono ? "font-mono text-xs" : "font-medium"}>{v}</span>
    </div>
  );
}
