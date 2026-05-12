// Supabase Edge Function: release-payout
//
// Releases a held booking through the atomic SQL RPC, then triggers the
// actual PSP transfer to the merchant's connected account. Idempotent on
// booking_id; safe to invoke from a cron worker, the merchant admin, or
// ops tools.
//
// Required secrets:
//   SUPABASE_URL                 (auto)
//   SUPABASE_SERVICE_ROLE_KEY    (auto)
//   MYFATOORAH_API_KEY           Bearer token from MyFatoorah portal
//   MYFATOORAH_BASE_URL          https://apitest.myfatoorah.com (staging)
//                                  https://api.myfatoorah.com (production KW)
//
// Deploy:
//   supabase functions deploy release-payout
//
// Cron worker example (Supabase Scheduled Functions or external cron):
//   POST {URL}/functions/v1/release-payout
//     {"action": "auto_release_due"}
// or for a single booking:
//   POST {URL}/functions/v1/release-payout
//     {"action": "release", "booking_id": "...", "reason": "service_completed", "actor": "user:abc"}

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ReleaseBody {
  action: "release";
  booking_id: string;
  reason: "service_completed" | "auto_release" | "manual_override" | "cancellation_window_expired";
  actor: string;
}
interface AutoReleaseBody {
  action: "auto_release_due";
  grace_minutes?: number;
}

type Body = ReleaseBody | AutoReleaseBody;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** PSP transfer — MyFatoorah Marketplace TransferToSupplier endpoint. */
async function transferToMerchant(opts: {
  baseUrl: string;
  apiKey: string;
  connectedAccountId: string;
  amount: number;
  currency: string;
  reference: string;
  payoutId: string;
}): Promise<{ transferId: string; ok: boolean; error?: string }> {
  // MyFatoorah's marketplace flow uses `SupplierDeposit` / Supplier transfers.
  // For other PSPs (Stripe Connect, Adyen MarketPay) swap this body shape.
  const resp = await fetch(`${opts.baseUrl}/v2/SupplierDeposit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      SupplierCode: opts.connectedAccountId,
      Amount: opts.amount,
      CurrencyIso: opts.currency,
      // Idempotency lives at the PSP layer too — payout_id is unique by design.
      ClientRefId: opts.payoutId,
      Description: `Bookit payout · ${opts.reference}`,
    }),
  });
  const data = (await resp.json()) as any;
  if (!resp.ok || data?.IsSuccess === false) {
    return { transferId: "", ok: false, error: data?.Message ?? `HTTP ${resp.status}` };
  }
  return {
    transferId: String(data?.Data?.TransferId ?? data?.Data?.InvoiceId ?? opts.payoutId),
    ok: true,
  };
}

async function releaseOne(
  supabase: ReturnType<typeof createClient>,
  body: ReleaseBody,
  env: { baseUrl: string; apiKey: string },
) {
  // 1. Atomic ledger + payout via RPC.
  const { data: payout, error: rpcErr } = await supabase.rpc("release_booking_payout", {
    p_booking_id: body.booking_id,
    p_reason: body.reason,
    p_actor: body.actor,
  });
  if (rpcErr) return { ok: false, error: rpcErr.message };
  const p = payout as any;

  // If RPC short-circuited (idempotent), the payout may already be transferred.
  if (p?.status === "transferred") return { ok: true, payout: p, idempotent: true };

  // 2. Load merchant's connected account.
  const { data: business } = await supabase
    .from("businesses")
    .select("id, connected_account_id")
    .eq("id", p.business_id)
    .maybeSingle();
  if (!business?.connected_account_id) {
    await supabase.from("payouts").update({
      status: "transfer_failed",
      last_error: "no_connected_account",
    }).eq("id", p.id);
    return { ok: false, error: "no_connected_account" };
  }

  // 3. Wire the funds.
  const tx = await transferToMerchant({
    baseUrl: env.baseUrl,
    apiKey: env.apiKey,
    connectedAccountId: business.connected_account_id,
    amount: Number(p.merchant_amount),
    currency: p.currency,
    reference: `BK-${String(p.booking_id).slice(0, 8)}`,
    payoutId: p.id,
  });

  if (!tx.ok) {
    await supabase.from("payouts").update({
      status: "transfer_failed",
      last_error: tx.error ?? "transfer_failed",
    }).eq("id", p.id);
    await supabase.from("bookings").update({
      payout_status: "transfer_failed",
    }).eq("id", p.booking_id);
    return { ok: false, error: tx.error, payout_id: p.id };
  }

  // 4. Mark transferred.
  await supabase.from("payouts").update({
    status: "transferred",
    provider_transfer_id: tx.transferId,
    transferred_at: new Date().toISOString(),
  }).eq("id", p.id);
  await supabase.from("bookings").update({
    payout_status: "completed",
  }).eq("id", p.booking_id);

  return { ok: true, payout_id: p.id, transfer_id: tx.transferId };
}

async function autoReleaseDue(
  supabase: ReturnType<typeof createClient>,
  graceMinutes: number,
  env: { baseUrl: string; apiKey: string },
) {
  // Find every booking whose service slot has ended + grace minutes elapsed
  // and whose payout is still held. Process serially so a flaky PSP doesn't
  // hammer them in parallel.
  const cutoff = new Date(Date.now() - graceMinutes * 60_000).toISOString();
  const { data: candidates, error } = await supabase
    .from("bookings")
    .select("id, time_slots!inner(end_time)")
    .eq("payout_status", "held")
    .eq("payment_status", "paid")
    .lte("time_slots.end_time", cutoff)
    .limit(100);
  if (error) return { ok: false, error: error.message };

  const results: Array<Record<string, unknown>> = [];
  for (const row of candidates ?? []) {
    const r = await releaseOne(supabase, {
      action: "release",
      booking_id: (row as any).id,
      reason: "auto_release",
      actor: "system:cron",
    }, env);
    results.push({ booking_id: (row as any).id, ...r });
  }
  return { ok: true, processed: results.length, results };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const apiKey = Deno.env.get("MYFATOORAH_API_KEY");
  const baseUrl = Deno.env.get("MYFATOORAH_BASE_URL") ?? "https://apitest.myfatoorah.com";
  if (!apiKey) return json({ error: "MYFATOORAH_API_KEY not set" }, 503);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  if (body.action === "release") {
    if (!body.booking_id || !body.reason || !body.actor) {
      return json({ error: "missing fields" }, 400);
    }
    const result = await releaseOne(supabase, body, { baseUrl, apiKey });
    return json(result, result.ok ? 200 : 502);
  }

  if (body.action === "auto_release_due") {
    const result = await autoReleaseDue(supabase, body.grace_minutes ?? 30, { baseUrl, apiKey });
    return json(result, result.ok ? 200 : 502);
  }

  return json({ error: "unknown action" }, 400);
});
