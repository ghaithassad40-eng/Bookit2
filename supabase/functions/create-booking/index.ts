// Supabase Edge Function: create-booking
// Atomic booking creation that delegates to the SQL RPC `create_booking_atomic`.
// Deploy with: supabase functions deploy create-booking

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BookingPayload {
  business_id: string;
  service_id: string;
  staff_id?: string | null;
  slot_id: string;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  notes?: string | null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let payload: BookingPayload;
  try {
    payload = (await req.json()) as BookingPayload;
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const required: (keyof BookingPayload)[] = [
    "business_id",
    "service_id",
    "slot_id",
    "customer_name",
  ];
  for (const key of required) {
    if (!payload[key]) return json({ error: `missing ${key}` }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase.rpc("create_booking_atomic", {
    p_business_id: payload.business_id,
    p_service_id: payload.service_id,
    p_staff_id: payload.staff_id ?? null,
    p_slot_id: payload.slot_id,
    p_customer_name: payload.customer_name,
    p_customer_phone: payload.customer_phone ?? null,
    p_customer_email: payload.customer_email ?? null,
    p_notes: payload.notes ?? null,
  });

  if (error) return json({ error: error.message }, 409);
  return json({ booking: data }, 201);
});
