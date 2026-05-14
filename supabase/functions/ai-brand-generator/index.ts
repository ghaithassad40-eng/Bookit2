// Supabase Edge Function: ai-brand-generator
//
// The PRD's headline AI capability. Vendor types ONE sentence describing
// their business — "women's pilates studio in Salmiya, 50-min sessions,
// 3 instructors" — and this function returns a structured JSON the admin
// can apply with one click:
//
//   { name, slug, industry, tagline,
//     theme: { mode, primaryColor, accentColor, secondaryColor, fontFamily },
//     copy: { heroTitle, heroSubtitle, ctaText, confirmationMessage },
//     copy_ar: { heroTitle, heroSubtitle, ctaText, confirmationMessage },
//     services: [{ name, description, duration_minutes, price, currency, capacity }],
//     staff_suggestions: ["Coach 1", ...],
//     paymentMethods: ["knet", "apple_pay", "visa", "google_pay"] }
//
// Backend: OpenRouter (per the PRD's tech stack). Model is configurable.
// Cost ≈ $0.001-$0.003 per generation depending on the model.
//
// Env (Supabase function secrets):
//   OPENROUTER_API_KEY   — token from openrouter.ai
//   OPENROUTER_MODEL     — optional, defaults to "anthropic/claude-3.5-haiku"

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  description: string;
  country?: string;    // ISO-2 (KW, SA, AE, …) — drives default currency + payment methods
  currency?: string;   // override
  language_hint?: "en" | "ar";
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT = `
You are a brand strategist + product designer for Bookit — a multi-tenant
booking SaaS used by service businesses in Kuwait, Saudi Arabia, and the UAE.

Given a single-sentence business description, return a JSON object that
fully bootstraps the vendor's branded booking page. Reply with VALID JSON
only — no surrounding prose, no markdown fences.

Schema:
{
  "name": string,                        // Polished display name (improve the user's phrasing)
  "slug": string,                        // lowercase, kebab-case, ASCII only
  "industry": string,                    // one of: gym, salon, clinic, yoga, spa, football, basketball, padel, cricket, tutor, photography, car, coworking, other
  "tagline": string,                     // ≤ 60 chars
  "theme": {
    "mode": "dark" | "light",
    "primaryColor": "#RRGGBB",           // dark-mode background OR light-mode background
    "accentColor": "#RRGGBB",            // brand colour (CTAs)
    "secondaryColor": "#RRGGBB",
    "fontFamily": "Inter" | "Plus Jakarta Sans"
  },
  "copy": {
    "heroTitle": string,                 // ≤ 60 chars, conversion-oriented
    "heroSubtitle": string,              // ≤ 140 chars
    "ctaText": string,                   // 2-3 words
    "confirmationMessage": string        // brand voice, ≤ 80 chars
  },
  "copy_ar": {                           // direct Arabic translation, same shape
    "heroTitle": string, "heroSubtitle": string, "ctaText": string, "confirmationMessage": string
  },
  "services": [                          // 2-5 realistic services
    { "name": string, "description": string,
      "duration_minutes": number, "price": number, "currency": "KWD"|"SAR"|"AED"|"USD",
      "capacity": number, "color": "#RRGGBB" }
  ],
  "staff_suggestions": string[],         // 1-3 culturally-appropriate placeholder names for the country
  "paymentMethods": string[],            // subset of: visa, apple_pay, google_pay, knet, mada, stcpay, uaecc, amex
  "booking_rules": {
    "allowStaffSelection": boolean,
    "slotDurationMinutes": number,
    "requirePayment": boolean
  }
}

Rules:
- Pick a theme that fits the vibe: gyms get dark + bold accents; salons get soft cream + warm; clinics get clean + medical sky; yoga gets calm pastel.
- For Kuwait businesses (KW), default to KWD + paymentMethods including knet + apple_pay.
- For Saudi (SA), default to SAR + mada + stcpay + apple_pay.
- For UAE (AE), default to AED + uaecc + visa + apple_pay.
- Prices should be realistic for the local market (KWD: gym session 5-25, salon 8-50, padel 12-20; SAR: padel court 120-200, salon 50-300; AED: cricket nets 60-100).
- Arabic translations must read naturally, not be literal word-for-word.
`.trim();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  const model = Deno.env.get("OPENROUTER_MODEL") ?? "anthropic/claude-3.5-haiku";
  if (!apiKey) return json({ error: "OPENROUTER_API_KEY not set" }, 503);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  if (!body.description?.trim()) return json({ error: "description required" }, 400);

  const userMessage = [
    `Description: ${body.description.trim()}`,
    body.country ? `Country: ${body.country.toUpperCase()}` : null,
    body.currency ? `Preferred currency: ${body.currency.toUpperCase()}` : null,
  ].filter(Boolean).join("\n");

  try {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://bookit.app",
        "X-Title": "Bookit Brand Generator",
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
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
    return json({ success: true, suggestion: parsed, model });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "unknown error" }, 500);
  }
});
