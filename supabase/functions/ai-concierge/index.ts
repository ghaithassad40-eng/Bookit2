// Supabase Edge Function: ai-concierge
// Optional LLM-powered concierge. The frontend works fine without this — it
// falls back to a local keyword matcher in `src/lib/concierge.ts`. Deploy
// this function and set VITE_USE_AI_CONCIERGE=true to upgrade.
//
// Required env (set as Supabase function secrets):
//   ANTHROPIC_API_KEY   — your Anthropic API key
//   SUPABASE_URL        — auto-populated
//   SUPABASE_ANON_KEY   — auto-populated (read-only public data is fine)
//
// Deploy:
//   supabase functions deploy ai-concierge
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  query: string;
  history?: { role: "user" | "assistant"; text: string }[];
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT = `You are a friendly booking concierge. Your job is to help
visitors find the right business to book with from a curated list. Reply in 1-2
short, warm sentences. Always include a JSON block at the end of your reply
formatted as:

<recommendations>
{"slugs": ["business-slug-1", "business-slug-2"]}
</recommendations>

Only include slugs from the provided list. If nothing matches, return
{"slugs": []} and offer alternatives. Never invent businesses.`;

interface BusinessLite {
  slug: string;
  name: string;
  industry: string;
  services: { name: string; description: string | null; price: number }[];
}

async function loadCatalog(supabase: ReturnType<typeof createClient>): Promise<BusinessLite[]> {
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, slug, name, industry")
    .eq("is_active", true)
    .limit(100);
  if (!businesses) return [];

  const ids = businesses.map((b: any) => b.id);
  const { data: services } = await supabase
    .from("services")
    .select("business_id, name, description, price")
    .in("business_id", ids)
    .eq("is_active", true);

  const byBiz = new Map<string, BusinessLite>();
  for (const b of businesses as any[]) {
    byBiz.set(b.id, { slug: b.slug, name: b.name, industry: b.industry, services: [] });
  }
  for (const s of (services ?? []) as any[]) {
    byBiz.get(s.business_id)?.services.push({
      name: s.name,
      description: s.description,
      price: Number(s.price),
    });
  }
  return [...byBiz.values()];
}

function parseSlugs(reply: string): string[] {
  const match = reply.match(/<recommendations>([\s\S]*?)<\/recommendations>/);
  if (!match) return [];
  try {
    const obj = JSON.parse(match[1].trim());
    return Array.isArray(obj?.slugs) ? obj.slugs.filter((s: unknown) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function stripRecommendations(reply: string): string {
  return reply.replace(/<recommendations>[\s\S]*?<\/recommendations>/, "").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "concierge not configured" }, 503);

  let payload: RequestBody;
  try {
    payload = (await req.json()) as RequestBody;
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  if (!payload.query?.trim()) return json({ error: "missing query" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false } },
  );
  const catalog = await loadCatalog(supabase);

  const catalogText = catalog
    .map(
      (b) =>
        `- ${b.slug} | ${b.name} (${b.industry})\n  services: ${b.services
          .slice(0, 4)
          .map((s) => `${s.name} ($${s.price})`)
          .join(", ") || "—"}`,
    )
    .join("\n");

  const userTurn = `Visitor said: "${payload.query}"\n\nAvailable businesses:\n${catalogText}`;

  const messages = [
    ...(payload.history ?? []).map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text,
    })),
    { role: "user", content: userTurn },
  ];

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-latest",
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return json({ error: "upstream error", detail: text }, 502);
  }

  const data = await resp.json();
  const reply = (data?.content?.[0]?.text ?? "") as string;
  const slugs = parseSlugs(reply);
  const matched = catalog.filter((c) => slugs.includes(c.slug));

  return json({
    message: stripRecommendations(reply),
    slugs,
    businesses: matched,
  });
});
