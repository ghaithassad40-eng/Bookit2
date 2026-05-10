import { useEffect, useRef } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { BusinessRow, BusinessConfigRow } from "@/lib/database.types";
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

/**
 * Verifies the gateway's redirect payload and routes to one of two pages:
 *   /business/:slug/confirmation?ref=...                 (success → invoice)
 *   /business/:slug/payment/failed?ref=...&reason=...    (failure)
 *
 * This component itself only ever shows a "verifying…" spinner and is never
 * the final destination.
 */
export default function PaymentCallback() {
  const { business } = useOutletContext<Ctx>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const ran = useRef(false);
  const createBooking = useCreateBooking();

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    function goFailed(reason: string, code?: string | null) {
      const reference = params.get("ref") ?? "";
      const u = new URLSearchParams();
      if (reference) u.set("ref", reference);
      u.set("reason", reason);
      if (code) u.set("code", code);
      navigate(`/business/${business.slug}/payment/failed?${u.toString()}`, { replace: true });
    }

    void (async () => {
      const reference = params.get("ref");
      const paymentId = params.get("paymentId") ?? params.get("Id");
      const invoiceId = params.get("Id");
      const errorFlag = params.get("error");

      if (errorFlag) {
        goFailed("Payment was cancelled before it completed.");
        return;
      }

      const cb = await verifyMyFatoorahCallback({
        paymentId,
        invoiceId,
        reference,
      });

      if (!cb.success) {
        goFailed(
          cb.error ?? `The bank returned status "${cb.status}". The charge did not go through.`,
          cb.transactionId,
        );
        return;
      }

      const pending = loadPendingBooking(reference ?? undefined);
      if (!pending) {
        // Payment succeeded but we lost the pending booking. Send to a degraded
        // "failed-but-charged" state so the customer can contact support.
        goFailed(
          "Payment captured, but we couldn't link it to a booking. Please contact support with the reference below.",
          cb.transactionId,
        );
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
        goFailed(
          err instanceof Error ? err.message : "We couldn't finalise the booking after capture.",
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container max-w-xl py-24 text-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <Loader2 className="h-10 w-10 animate-spin text-accent" />
        <h1 className="text-2xl font-semibold tracking-tight">Verifying payment…</h1>
        <p className="text-sm text-muted-foreground">
          We're confirming the transaction with the gateway. This usually takes a few seconds.
        </p>
      </motion.div>
    </div>
  );
}
