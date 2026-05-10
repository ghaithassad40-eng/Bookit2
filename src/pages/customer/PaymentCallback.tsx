import { useEffect, useRef, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import type { BusinessRow, BusinessConfigRow } from "@/lib/database.types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  callbackToPaymentResult,
  clearPendingBooking,
  loadPendingBooking,
  verifyMyFatoorahCallback,
} from "@/lib/myfatoorah";
import { useCreateBooking } from "@/hooks/useBookings";

interface Ctx {
  business: BusinessRow;
  config: BusinessConfigRow;
}

type Stage = "verifying" | "success" | "failed";

export default function PaymentCallback() {
  const { business } = useOutletContext<Ctx>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [stage, setStage] = useState<Stage>("verifying");
  const [message, setMessage] = useState<string>("Confirming your payment with the bank…");
  const ran = useRef(false);
  const createBooking = useCreateBooking();

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    void (async () => {
      const reference = params.get("ref");
      const paymentId = params.get("paymentId") ?? params.get("Id");
      const invoiceId = params.get("Id");
      const errorFlag = params.get("error");

      if (errorFlag) {
        setStage("failed");
        setMessage("Payment was cancelled or failed. You haven't been charged.");
        return;
      }

      const cb = await verifyMyFatoorahCallback({
        paymentId,
        invoiceId,
        reference,
      });

      if (!cb.success) {
        setStage("failed");
        setMessage(cb.error ?? `Payment ${cb.status.toLowerCase()}. Please try again.`);
        return;
      }

      // Pull the pending booking we stored before redirect and finalise it.
      const pending = loadPendingBooking(reference ?? undefined);
      if (!pending) {
        // No pending — payment succeeded but we don't know which slot.
        setStage("success");
        setMessage("Payment confirmed. We couldn't find the original booking — please contact support with the reference below.");
        return;
      }

      try {
        const paymentResult = callbackToPaymentResult(pending.method, cb);
        const booking = await createBooking.mutateAsync({
          business_id: pending.business_id,
          service_id: pending.service_id,
          staff_id: pending.staff_id,
          slot_id: pending.slot_id,
          customer_name: pending.customer_name,
          customer_phone: pending.customer_phone,
          customer_email: pending.customer_email,
          notes: pending.notes,
          payment: paymentResult,
          payment_amount: pending.amount,
          payment_currency: pending.currency,
        });
        clearPendingBooking();
        navigate(
          `/business/${business.slug}/confirmation?ref=${encodeURIComponent(booking.booking_reference)}`,
          { replace: true },
        );
      } catch (err) {
        setStage("failed");
        setMessage(
          err instanceof Error
            ? `Payment captured, but we couldn't finalise the booking: ${err.message}. Contact us with the reference below.`
            : "Payment captured but booking failed.",
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container max-w-xl py-16 text-center">
      {stage === "verifying" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Loader2 className="h-10 w-10 animate-spin text-accent" />
          <h1 className="text-2xl font-semibold tracking-tight">Verifying payment…</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </motion.div>
      )}

      {stage === "failed" && (
        <Card className="text-left">
          <CardContent className="space-y-4 pt-6">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-rose-500/15 text-rose-500">
              <XCircle className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-semibold">Payment didn't go through</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
            <div className="flex gap-2">
              <Button onClick={() => navigate(`/business/${business.slug}/book`, { replace: true })}>
                Try again
              </Button>
              <Button variant="outline" onClick={() => navigate(`/business/${business.slug}`, { replace: true })}>
                Back to {business.name}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {stage === "success" && (
        <Card className="text-left">
          <CardContent className="space-y-3 pt-6">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-500/15 text-emerald-500">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-semibold">Payment confirmed</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
