// Supabase Edge Function: myfatoorah-initiate
// Initiates a MyFatoorah payment session and returns the hosted PaymentURL
// the frontend should redirect the customer to.
//
// Flow:
//   1. Frontend POSTs { method, amount, currency, reference, customer, business_slug }
//   2. We call MyFatoorah InitiatePayment to get the list of available
//      methods + service charge for the requested currency.
//   3. We resolve the requested method to MyFatoorah's PaymentMethodId.
//   4. We call MyFatoorah ExecutePayment to create the invoice and get back
//      the IFrameUrl / PaymentURL to redirect the customer to.
//   5. We persist the invoice_id and reference so the callback can verify it.
//
// Env (set as Supabase function secrets):
//   MYFATOORAH_API_KEY        — bearer token from MyFatoorah portal
//   MYFATOORAH_BASE_URL       — https://apitest.myfatoorah.com  (staging)
//                                or https://api.myfatoorah.com  (production KW)
//   MYFATOORAH_RETURN_BASE    — public origin of your site (e.g. https://bookit.app)
//                                Used to build CallBackUrl/ErrorUrl.
//
// Deploy:
//   supabase functions deploy myfatoorah-initiate
//   supabase secrets set MYFATOORAH_API_KEY=...
//   supabase secrets set MYFATOORAH_BASE_URL=https://apitest.myfatoorah.com
//   supabase secrets set MYFATOORAH_RETURN_BASE=https://your-site.com

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type InternalMethod =
  | "visa"
  | "apple_pay"
  | "google_pay"
  | "samsung_pay"
  | "knet"
  | "mada"
  | "amex"
  | "stcpay"
  | "any";

interface InitiateRequest {
  method: InternalMethod;
  amount: number;
  currency: string;
  reference: string;
  business_slug: string;
  customer: {
    name: string;
    phone?: string | null;
    email?: string | null;
  };
  // Optional pre-created booking id to bind to the invoice.
  booking_id?: string | null;
  language?: "EN" | "AR";
}

interface InitiateResult {
  success: boolean;
  paymentUrl?: string;
  invoiceId?: number;
  customerReference?: string;
  expiresAt?: string;
  error?: string;
  raw?: unknown;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// MyFatoorah PaymentMethodId mapping. The actual list returned by
// InitiatePayment depends on your account + currency; we look up by
// PaymentMethodCode below to be resilient.
const METHOD_CODES: Record<InternalMethod, string[]> = {
  visa: ["vm", "vmc", "creditcard"],
  apple_pay: ["ap", "applepay"],
  google_pay: ["gp", "googlepay"],
  samsung_pay: ["sp", "samsungpay"],
  knet: ["kn", "knet"],
  mada: ["md", "mada"],
  amex: ["ae", "amex"],
  stcpay: ["stcpay", "stc"],
  any: [], // empty → use SendPayment (lets MyFatoorah show all available)
};

interface MFPaymentMethod {
  PaymentMethodId: number;
  PaymentMethodCode: string;
  PaymentMethodEn: string;
  PaymentMethodAr: string;
  ServiceCharge: number;
  TotalAmount: number;
  CurrencyIso: string;
  /** The currency the gateway settles in. Use this to prefer same-currency
   * variants (e.g. KWD-routed Apple Pay over SAR-routed Apple Pay). */
  PaymentCurrencyIso?: string;
  IsDirectPayment: boolean;
}

async function mfFetch<T>(
  baseUrl: string,
  apiKey: string,
  path: string,
  body: unknown,
): Promise<T> {
  const resp = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await resp.json()) as { IsSuccess?: boolean; Message?: string; Data?: T };
  if (!resp.ok || data?.IsSuccess === false) {
    throw new Error(data?.Message ?? `MyFatoorah ${path} failed (${resp.status})`);
  }
  return data.Data as T;
}

async function initiatePayment(
  baseUrl: string,
  apiKey: string,
  amount: number,
  currency: string,
): Promise<MFPaymentMethod[]> {
  const data = await mfFetch<{ PaymentMethods: MFPaymentMethod[] }>(
    baseUrl,
    apiKey,
    "/v2/InitiatePayment",
    { InvoiceAmount: amount, CurrencyIso: currency },
  );
  return data.PaymentMethods ?? [];
}

interface ResolvedMethod {
  id: number;
  settlementCurrency: string | null;
  codeMatched: string;
}

function resolveMethod(
  methods: MFPaymentMethod[],
  internal: InternalMethod,
  currency: string,
): ResolvedMethod | null {
  if (internal === "any") return null;
  const codes = METHOD_CODES[internal] ?? [];

  // Prefer exact code matches over substring matches so e.g. AMEX (code
  // "ae") doesn't get confused with UAE Cards (code "uaecc") just because
  // the latter contains "ae".
  const exact: MFPaymentMethod[] = [];
  const startsWith: MFPaymentMethod[] = [];
  const contains: MFPaymentMethod[] = [];
  for (const m of methods) {
    const code = (m.PaymentMethodCode ?? "").toLowerCase();
    if (codes.includes(code)) exact.push(m);
    else if (codes.some((c) => code.startsWith(c))) startsWith.push(m);
    else if (codes.some((c) => code.includes(c))) contains.push(m);
  }
  const candidates: MFPaymentMethod[] =
    exact.length > 0 ? exact : startsWith.length > 0 ? startsWith : contains;

  if (candidates.length === 0) {
    // Last-resort English-name match.
    const fallback = methods.find((m) =>
      m.PaymentMethodEn?.toLowerCase().includes(internal.replace("_", " ")),
    );
    return fallback
      ? {
          id: fallback.PaymentMethodId,
          settlementCurrency: fallback.PaymentCurrencyIso ?? null,
          codeMatched: fallback.PaymentMethodCode,
        }
      : null;
  }

  // Prefer same-currency settlement so customers don't get hit with
  // unexpected FX conversion (e.g. Apple Pay routed via SAR for a KWD
  // invoice).
  const sameCurrency = candidates.find(
    (m) => (m.PaymentCurrencyIso ?? "").toUpperCase() === currency.toUpperCase(),
  );
  const chosen = sameCurrency ?? candidates[0];
  return {
    id: chosen.PaymentMethodId,
    settlementCurrency: chosen.PaymentCurrencyIso ?? null,
    codeMatched: chosen.PaymentMethodCode,
  };
}

interface ExecuteResp {
  InvoiceId: number;
  IsDirectPayment: boolean;
  PaymentURL: string;
  CustomerReference: string;
}

async function executePayment(
  baseUrl: string,
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<ExecuteResp> {
  return mfFetch<ExecuteResp>(baseUrl, apiKey, "/v2/ExecutePayment", payload);
}

async function sendPayment(
  baseUrl: string,
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<ExecuteResp> {
  return mfFetch<ExecuteResp>(baseUrl, apiKey, "/v2/SendPayment", payload);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method not allowed" }, 405);

  const apiKey = Deno.env.get("MYFATOORAH_API_KEY");
  const baseUrl = Deno.env.get("MYFATOORAH_BASE_URL") ?? "https://apitest.myfatoorah.com";
  const returnBase = Deno.env.get("MYFATOORAH_RETURN_BASE") ?? "";
  if (!apiKey) {
    return json({ success: false, error: "MYFATOORAH_API_KEY not set" }, 503);
  }

  let payload: InitiateRequest;
  try {
    payload = (await req.json()) as InitiateRequest;
  } catch {
    return json({ success: false, error: "invalid json" }, 400);
  }

  if (!payload.amount || !payload.currency || !payload.reference || !payload.business_slug) {
    return json({ success: false, error: "missing fields" }, 400);
  }

  try {
    // 1) Discover available payment methods + per-method fees in this currency.
    const methods = await initiatePayment(baseUrl, apiKey, payload.amount, payload.currency);

    // 2) Build callback URLs the customer is redirected to after paying.
    const callbackUrl = `${returnBase}/business/${payload.business_slug}/payment/callback?ref=${encodeURIComponent(payload.reference)}`;
    const errorUrl = `${returnBase}/business/${payload.business_slug}/payment/callback?ref=${encodeURIComponent(payload.reference)}&error=1`;

    // 3) Choose ExecutePayment (specific method) or SendPayment (all methods).
    const resolved = resolveMethod(methods, payload.method, payload.currency);

    const commonBody = {
      CustomerName: payload.customer.name,
      DisplayCurrencyIso: payload.currency,
      MobileCountryCode: "+965",
      CustomerMobile: (payload.customer.phone ?? "").replace(/\D/g, "") || "00000000",
      CustomerEmail: payload.customer.email ?? "noreply@bookit.local",
      InvoiceValue: payload.amount,
      CallBackUrl: callbackUrl,
      ErrorUrl: errorUrl,
      Language: payload.language ?? "EN",
      CustomerReference: payload.reference,
      UserDefinedField: payload.booking_id ?? payload.reference,
    };

    let result: ExecuteResp;
    if (resolved) {
      result = await executePayment(baseUrl, apiKey, {
        ...commonBody,
        PaymentMethodId: resolved.id,
      });
    } else {
      // No specific method requested → MyFatoorah-hosted picker for all.
      result = await sendPayment(baseUrl, apiKey, {
        ...commonBody,
        NotificationOption: "LNK",
      });
    }

    // 4) Persist a payment_events row so the callback can correlate.
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
        { auth: { persistSession: false } },
      );
      // Look up business id from slug for the audit row.
      const { data: biz } = await supabase
        .from("businesses")
        .select("id")
        .eq("slug", payload.business_slug)
        .maybeSingle();
      if (biz?.id) {
        await supabase.from("payment_events").insert({
          business_id: biz.id,
          booking_id: payload.booking_id ?? null,
          provider: "myfatoorah",
          event_type: "initiated",
          amount: payload.amount,
          currency: payload.currency,
          transaction_id: String(result.InvoiceId),
          provider_ref: result.CustomerReference ?? payload.reference,
          raw_payload: result as unknown as Record<string, unknown>,
        });
      }
    } catch {
      // best-effort audit; never block the customer on logging issues
    }

    const out: InitiateResult = {
      success: true,
      paymentUrl: result.PaymentURL,
      invoiceId: result.InvoiceId,
      customerReference: result.CustomerReference,
    };
    // Include diagnostic info so the frontend can show the customer the
    // exact gateway variant (e.g. "Apple Pay · KWD" vs "Apple Pay · SAR").
    return json(
      {
        ...out,
        settlementCurrency: resolved?.settlementCurrency ?? null,
        paymentMethodCode: resolved?.codeMatched ?? null,
        paymentMethodId: resolved?.id ?? null,
      },
      200,
    );
  } catch (err) {
    return json(
      { success: false, error: err instanceof Error ? err.message : "MyFatoorah error" },
      502,
    );
  }
});
