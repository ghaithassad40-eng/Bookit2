// Supabase Edge Function: ai-equipment-search
//
// Customer types a natural-language query like "find me a vendor with a 4K
// monitor and ergonomic chair" → this function returns the matching
// business_ids ranked by relevance, with a short human explanation per
// match ("4K External Monitor + Ergonomic Chair Upgrade match your query").
//
// Strategy:
//   1. Fetch the active equipment catalog from the `equipment` table.
//   2. Send the user's query + a compressed catalog snippet to the LLM,
//      asking it to return JSON: { matches: [{ business_id, reason, score }] }
//   3. The client receives the ranked list and joins to the businesses
//      table client-side (cheaper than another round-trip from the function).
//
// Env (Supabase function secrets):
//   OPENROUTER_API_KEY   — token from openrouter.ai
//   OPENROUTER_MODEL     — optional, defaults to "anthropic/claude-3.5-haiku"
//
// The client (src/hooks/useEquipmentSearch.ts) falls back to the local
// keyword matcher in src/lib/equipmentSearch.ts when this function is
// unreachable or returns an error — so the demo experience never breaks.

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  query: string;
  /** Optional country filter (KW, SA, AE, …). When provided, only equipment
   *  belonging to businesses in that country is considered. */
  country?: string;
  /** Optional language hint, used to nudge the reasons toward Arabic when ar. */
  language_hint?: "en" | "ar";
}

interface EquipmentRow {
  id: string;
  business_id: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  category: string;
  price: number | null;
  currency: string;
  features: string[];
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT = `
You are an equipment-matching assistant for Bookit, a marketplace where
vendors offer add-on equipment alongside their booked services (e.g. a
co-working space offering a 4K monitor, a padel court offering racket
rental).

Given the customer's natural-language query and a catalog of available
equipment items (each with name, features, and a business_id), return JSON
matching this schema:

{
  "matches": [
    {
      "business_id": "<id>",
      "score": <integer 1-10>,
      "reason": "<short explanation, ≤ 120 chars>",
      "equipment_ids": ["<id>", "<id>"]
    }
  ]
}

Rules:
- Return at most 6 matches, ranked best to worst.
- A match is valid only when at least one equipment item in that business
  meaningfully matches the customer's intent. Don't invent equipment.
- Score 9-10 = perfect match (every requested item available). 5-8 = partial
  match. 1-4 = weak match (only loosely related).
- Reason should mention the matched equipment by name and feel like a human
  recommendation, not a list. Match the language hint when provided.
- Reply with valid JSON only — no surrounding prose, no markdown fences.
`.trim();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  const model = Deno.env.get("OPENROUTER_MODEL") ?? "anthropic/claude-3.5-haiku";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!apiKey) return json({ error: "OPENROUTER_API_KEY not set" }, 503);
  if (!supabaseUrl || !serviceKey) return json({ error: "supabase env not set" }, 503);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  if (!body.query?.trim()) return json({ error: "query required" }, 400);

  // ── Load the equipment catalog ─────────────────────────────────────────
  const supa = createClient(supabaseUrl, serviceKey);
  let q = supa
    .from("equipment")
    .select(
      "id, business_id, name, name_ar, description, category, price, currency, features, is_active, businesses!inner(country, status)",
    )
    .eq("is_active", true);
  if (body.country) {
    q = q.eq("businesses.country", body.country.toUpperCase());
  }
  // Only equipment belonging to approved businesses is surfaced (mirrors the
  // marketplace approval gate on the public landing pages).
  q = q.eq("businesses.status", "approved");

  const { data, error } = await q;
  if (error) return json({ error: "catalog query failed", detail: error.message }, 500);
  const catalog = ((data ?? []) as unknown[]) as Array<EquipmentRow & { businesses: unknown }>;

  if (catalog.length === 0) {
    return json({ success: true, matches: [], model, reason: "empty catalog" });
  }

  // ── Compress the catalog for the LLM ───────────────────────────────────
  // 1 line per item, ~50 tokens each — keeps the prompt cheap.
  const snippet = catalog
    .map((row) => {
      const features = row.features?.join(", ") ?? "";
      const price = row.price == null ? "free" : `${row.price} ${row.currency}`;
      return `${row.id} | biz=${row.business_id} | ${row.name} (${row.category}, ${price}) — features: ${features}`;
    })
    .join("\n");

  const userMessage = [
    `Customer query: ${body.query.trim()}`,
    body.country ? `Country filter: ${body.country.toUpperCase()}` : null,
    body.language_hint ? `Reply language hint: ${body.language_hint}` : null,
    `Equipment catalog:\n${snippet}`,
  ].filter(Boolean).join("\n\n");

  try {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://bookit.app",
        "X-Title": "Bookit Equipment Search",
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return json({ error: "upstream error", detail }, 502);
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return json({ error: "model returned invalid JSON", raw }, 502);
    }
    return json({ success: true, ...(parsed as object), model });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "unknown error" }, 500);
  }
});
