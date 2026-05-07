import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, Calendar, ShieldCheck } from "lucide-react";
import type { BusinessRow, BusinessConfigRow } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PaymentBrandMark } from "@/components/customer/PaymentBrandMark";
import { PAYMENT_METHODS, type PaymentMethodId } from "@/lib/payments";
import { getLocalBookings } from "@/lib/localBookings";
import { formatCurrency } from "@/lib/utils";

interface Ctx {
  business: BusinessRow;
  config: BusinessConfigRow;
}

export default function Confirmation() {
  const { business, config } = useOutletContext<Ctx>();
  const [params] = useSearchParams();
  const reference = params.get("ref");

  // pull payment metadata for display from local store
  const booking = reference
    ? getLocalBookings().find((b) => b.booking_reference === reference)
    : null;

  return (
    <div className="container max-w-2xl py-16 text-center">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 18, stiffness: 220 }}
        className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-500"
      >
        <CheckCircle2 className="h-8 w-8" />
      </motion.div>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {config.copy_json.confirmationMessage}
      </h1>
      {reference && (
        <p className="mt-3 text-sm text-muted-foreground">
          Reference: <span className="font-mono font-medium text-foreground">{reference}</span>
        </p>
      )}

      <Card className="mx-auto mt-10 max-w-md text-left">
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-accent" />
            <div>
              <p className="text-sm font-medium">Add to your calendar</p>
              <p className="text-xs text-muted-foreground">
                We've also emailed your confirmation if an address was provided.
              </p>
            </div>
          </div>

          {booking?.payment_status === "paid" && booking.payment_method && (
            <div className="flex items-center gap-3 border-t border-border/60 pt-4">
              <PaymentBrandMark method={booking.payment_method as PaymentMethodId} />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  Paid {booking.payment_amount != null
                    ? formatCurrency(booking.payment_amount, booking.payment_currency ?? "USD")
                    : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  via {PAYMENT_METHODS[booking.payment_method as PaymentMethodId]?.shortLabel}
                  {booking.payment_transaction_id && (
                    <> · <span className="font-mono">{booking.payment_transaction_id}</span></>
                  )}
                </p>
              </div>
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button asChild>
          <Link to={`/business/${business.slug}`}>
            Back to {business.name}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to={`/business/${business.slug}/book`}>Book another</Link>
        </Button>
      </div>
    </div>
  );
}
