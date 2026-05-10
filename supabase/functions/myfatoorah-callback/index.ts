// Supabase Edge Function: myfatoorah-callback
// Verifies a MyFatoorah payment after the customer is redirected back to the
// site. Calls GetPaymentStatus to confirm the invoice was paid, then either
// flips the booking to paid+confirmed or records the failure.
//
// Two ways to verify:
//   - paymentId       (returned in the redirect query as `paymentId`)
//   - invoiceId       (our stored MyFatoorah invoice id)
//
// Env:
//   MYFATOORAH_API_KEY
//   MYFATOORAH_BASE_URL
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (auto-populated)

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CallbackRequest {
  paymentId?: string;
  invoiceId?: string | number;
  reference?: string;
}

interface MFStatus {
  InvoiceId: number;
  InvoiceStatus: "Paid" | "Pending" | "Failed" | "Expired" | "Refunded";
  InvoiceReference: string | null;
  CustomerReference: string | null;
  CreatedDate: string;
  ExpiryDate: string | null;
  InvoiceValue: number;
  CustomerName: string;
  CustomerMobile: string;
  CustomerEmail: string;
  UserDefinedField: string | null;
  InvoiceTransactions: Array<{
    TransactionDate: string;
    PaymentGateway: string;
    PaymentId: string;
    AuthorizationId: string | null;
    TransactionStatus: "Succss" | "Success" | "Failed" | "Pending";
    TrasactionValue: string;
    Currency: string;
    Error: string | null;
    CardNumber: string | null;
  }>;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getPaymentStatus(
  baseUrl: string,
  apiKey: string,
  payload: { Key: string; KeyType: "PaymentId" | "InvoiceId" },
): Promise<MFStatus> {
  const resp = await fetch(`${baseUrl}/v2/GetPaymentStatus`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = (await resp.json()) as { IsSuccess?: boolean; Message?: string; Data?: MFStatus };
  if (!resp.ok || data?.IsSuccess === false) {
    throw new Error(data?.Message ?? `MyFatoorah GetPaymentStatus failed (${resp.status})`);
  }
  return data.Data as MFStatus;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method not allowed" }, 405);

  const apiKey = Deno.env.get("MYFATOORAH_API_KEY");
  const baseUrl = Deno.env.get("MYFATOORAH_BASE_URL") ?? "https://apitest.myfatoorah.com";
  if (!apiKey) return json({ success: false, error: "MYFATOORAH_API_KEY not set" }, 503);

  let payload: CallbackRequest;
  try {
    payload = (await req.json()) as CallbackRequest;
  } catch {
    return json({ success: false, error: "invalid json" }, 400);
  }

  if (!payload.paymentId && !payload.invoiceId) {
    return json({ success: false, error: "paymentId or invoiceId required" }, 400);
  }

  try {
    const status = payload.paymentId
      ? await getPaymentStatus(baseUrl, apiKey, { Key: String(payload.paymentId), KeyType: "PaymentId" })
      : await getPaymentStatus(baseUrl, apiKey, { Key: String(payload.invoiceId), KeyType: "InvoiceId" });

    const tx = status.InvoiceTransactions?.[0];
    const isPaid = status.InvoiceStatus === "Paid" && (tx?.TransactionStatus === "Success" || tx?.TransactionStatus === "Succss");

    // Reconcile: write to bookings + audit log
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false } },
    );

    const customerRef = status.CustomerReference ?? payload.reference ?? null;
    if (customerRef) {
      const newStatus = isPaid ? "paid" : status.InvoiceStatus === "Pending" ? "pending" : "failed";
      // Find the booking by reference (we set CustomerReference = booking_reference at initiate time)
      await supabase
        .from("bookings")
        .update({
          payment_status: newStatus,
          payment_transaction_id: tx?.PaymentId ?? String(status.InvoiceId),
          payment_provider_ref: String(status.InvoiceId),
          payment_method: tx?.PaymentGateway ?? null,
        })
        .eq("booking_reference", customerRef);
    }

    // Audit
    try {
      const { data: biz } = await supabase
        .from("payment_events")
        .insert({
          business_id: null,
          booking_id: null,
          provider: "myfatoorah",
          event_type: isPaid ? "captured" : `status:${status.InvoiceStatus}`,
          amount: status.InvoiceValue,
          currency: tx?.Currency ?? null,
          transaction_id: tx?.PaymentId ?? String(status.InvoiceId),
          provider_ref: String(status.InvoiceId),
          raw_payload: status as unknown as Record<string, unknown>,
        })
        .select("id")
        .single();
      void biz;
    } catch {
      // best effort
    }

    return json({
      success: isPaid,
      status: status.InvoiceStatus,
      transactionStatus: tx?.TransactionStatus ?? null,
      paymentGateway: tx?.PaymentGateway ?? null,
      transactionId: tx?.PaymentId ?? null,
      invoiceId: status.InvoiceId,
      customerReference: customerRef,
      amount: status.InvoiceValue,
      cardNumber: tx?.CardNumber ?? null,
      error: tx?.Error ?? null,
    });
  } catch (err) {
    return json(
      { success: false, error: err instanceof Error ? err.message : "verification failed" },
      502,
    );
  }
});
