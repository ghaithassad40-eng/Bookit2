// Supabase Edge Function: charge-payment
// Server-side payment dispatcher. Routes each method to its real provider
// using secrets stored in Supabase. The frontend can stay payment-method
// agnostic — it just POSTs `{ method, amount, currency, reference, card? }`
// and gets back `{ success, transactionId, providerRef }`.
//
// Required secrets (set per-method as needed):
//   STRIPE_SECRET_KEY            — for visa, apple_pay, google_pay
//   PAYPAL_CLIENT_ID
//   PAYPAL_SECRET
//   KNET_MERCHANT_ID             — Knet (or MyFatoorah) credentials
//   KNET_API_KEY
//   SAMSUNG_PAY_SERVICE_ID       — Samsung Pay
//
// Deploy:
//   supabase functions deploy charge-payment
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_...

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Method = "visa" | "apple_pay" | "google_pay" | "samsung_pay" | "paypal" | "knet";

interface ChargeRequest {
  method: Method;
  amount: number;       // major units (e.g. 25.50)
  currency: string;     // ISO-4217 (e.g. USD, KWD)
  reference: string;
  card?: {
    number: string; expMonth: string; expYear: string; cvc: string; holder: string;
  };
}

interface ChargeResult {
  success: boolean;
  transactionId: string;
  method: Method;
  last4?: string | null;
  brand?: string | null;
  providerRef?: string | null;
  error?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Stripe — handles card + Apple Pay + Google Pay
// ---------------------------------------------------------------------------

async function chargeStripe(req: ChargeRequest): Promise<ChargeResult> {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) return { success: false, transactionId: "", method: req.method, error: "Stripe not configured" };

  // For real card processing you'd use Stripe Payment Intents and never send
  // the raw PAN to Edge Functions — collect via Stripe Elements / Payment
  // Element on the client and pass a payment_method id here. The shape below
  // is illustrative.
  const params = new URLSearchParams({
    amount: String(Math.round(req.amount * 100)),
    currency: req.currency.toLowerCase(),
    description: `Bookit ${req.reference}`,
    "automatic_payment_methods[enabled]": "true",
  });

  const resp = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const data = await resp.json();
  if (!resp.ok) {
    return { success: false, transactionId: "", method: req.method, error: data?.error?.message ?? "Stripe error" };
  }
  return {
    success: true,
    transactionId: data.id,
    method: req.method,
    providerRef: data.id,
    brand: data.charges?.data?.[0]?.payment_method_details?.card?.brand ?? null,
    last4: data.charges?.data?.[0]?.payment_method_details?.card?.last4 ?? null,
  };
}

// ---------------------------------------------------------------------------
// PayPal
// ---------------------------------------------------------------------------

async function chargePaypal(req: ChargeRequest): Promise<ChargeResult> {
  const id = Deno.env.get("PAYPAL_CLIENT_ID");
  const secret = Deno.env.get("PAYPAL_SECRET");
  if (!id || !secret) return { success: false, transactionId: "", method: req.method, error: "PayPal not configured" };

  // OAuth → create order. Real flow: client gets approval URL, redirects user,
  // then captures the order. This stub creates the order for illustration.
  const tokenResp = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const token = (await tokenResp.json())?.access_token;
  if (!token) return { success: false, transactionId: "", method: req.method, error: "PayPal auth failed" };

  const orderResp = await fetch("https://api-m.paypal.com/v2/checkout/orders", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: req.reference,
          amount: { currency_code: req.currency, value: req.amount.toFixed(2) },
        },
      ],
    }),
  });
  const order = await orderResp.json();
  if (!orderResp.ok) return { success: false, transactionId: "", method: req.method, error: order?.message ?? "PayPal error" };

  return {
    success: true,
    transactionId: order.id,
    method: "paypal",
    providerRef: order.id,
  };
}

// ---------------------------------------------------------------------------
// Knet (Kuwait) — typically integrated via MyFatoorah or KFAST
// ---------------------------------------------------------------------------

async function chargeKnet(req: ChargeRequest): Promise<ChargeResult> {
  const merchantId = Deno.env.get("KNET_MERCHANT_ID");
  const apiKey = Deno.env.get("KNET_API_KEY");
  if (!merchantId || !apiKey) {
    return { success: false, transactionId: "", method: req.method, error: "Knet not configured" };
  }

  // Real integration: call MyFatoorah's `SendPayment` endpoint to obtain a
  // `PaymentURL`, return that to the frontend, redirect the user, then
  // verify via `getPaymentStatus` once they return. Below is a sketch.
  const resp = await fetch("https://api.myfatoorah.com/v2/SendPayment", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      InvoiceAmount: req.amount,
      CurrencyIso: req.currency,
      CustomerReference: req.reference,
      PaymentMethodId: 1, // 1 = KNET on MyFatoorah
    }),
  });
  const data = await resp.json();
  if (!resp.ok || !data?.IsSuccess) {
    return { success: false, transactionId: "", method: "knet", error: data?.Message ?? "Knet error" };
  }
  return {
    success: true,
    transactionId: String(data.Data.InvoiceId),
    method: "knet",
    brand: "Knet",
    providerRef: data.Data.PaymentURL,
  };
}

// ---------------------------------------------------------------------------
// Samsung Pay — typically tokenised through a partner processor
// ---------------------------------------------------------------------------

async function chargeSamsung(req: ChargeRequest): Promise<ChargeResult> {
  // In practice Samsung Pay produces a network token that's then charged via
  // your card processor (Stripe/Adyen/Checkout). Route through Stripe here.
  return chargeStripe({ ...req, method: "samsung_pay" });
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let payload: ChargeRequest;
  try {
    payload = (await req.json()) as ChargeRequest;
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  if (!payload.method || !payload.amount || !payload.currency || !payload.reference) {
    return json({ error: "missing fields" }, 400);
  }

  let result: ChargeResult;
  switch (payload.method) {
    case "visa":
    case "apple_pay":
    case "google_pay":
      result = await chargeStripe(payload);
      break;
    case "samsung_pay":
      result = await chargeSamsung(payload);
      break;
    case "paypal":
      result = await chargePaypal(payload);
      break;
    case "knet":
      result = await chargeKnet(payload);
      break;
    default:
      return json({ error: "unsupported method" }, 400);
  }

  return json(result, result.success ? 200 : 402);
});
