import type { BusinessRow, ServiceRow } from "./database.types";

// ---------------------------------------------------------------------------
// Local concierge — keyword/intent matcher with conversational replies.
// Works with zero setup. The companion edge function (ai-concierge) can be
// swapped in for a real LLM by setting VITE_USE_AI_CONCIERGE=true.
// ---------------------------------------------------------------------------

export interface ConciergeContext {
  businesses: BusinessRow[];
  servicesByBusiness: Record<string, ServiceRow[]>;
}

export interface ConciergeMatch {
  business: BusinessRow;
  matchedServices: ServiceRow[];
  score: number;
}

export interface ConciergeReply {
  message: string;
  matches: ConciergeMatch[];
  followUp?: string;
}

// Map common customer intents → industry/service keywords
const INTENT_KEYWORDS: Record<string, string[]> = {
  gym: ["gym", "workout", "training", "trainer", "fitness", "lift", "weights", "exercise", "hiit", "cardio", "muscle"],
  salon: ["salon", "haircut", "hair", "cut", "color", "stylist", "blowout", "balayage", "highlights", "barber", "beard"],
  clinic: ["clinic", "doctor", "physician", "appointment", "visit", "checkup", "physical", "health", "medical", "consult"],
  yoga: ["yoga", "stretch", "flow", "vinyasa", "yin", "meditation", "mindful", "breath"],
  spa: ["spa", "massage", "relax", "facial", "treatment"],
  barber: ["barber", "beard", "shave"],
  tutor: ["tutor", "lesson", "study", "homework", "math", "english"],
  coworking: ["coworking", "desk", "office", "workspace"],
  car: ["car", "auto", "wash", "service", "oil change", "tire"],
  photo: ["photo", "shoot", "portrait", "headshot", "photography"],
  // Sports
  football: ["football", "soccer", "5v5", "7v7", "5aside", "7aside", "pitch", "turf", "futsal", "match", "kickabout", "goalkeeper", "striker"],
  basketball: ["basketball", "basket", "hoops", "fullcourt", "halfcourt", "court", "shoot", "dunk", "dribble"],
  padel: ["padel", "paddle", "racquet", "racket"],
  cricket: ["cricket", "nets", "batting", "bowling", "wicket", "bowler", "batsman"],
};

const STOPWORDS = new Set([
  "i", "a", "an", "the", "to", "for", "and", "or", "of", "in", "on",
  "is", "am", "are", "be", "do", "you", "me", "my", "want", "need", "looking",
  "would", "like", "can", "help", "find", "book", "get", "have", "any", "some",
  "please", "hi", "hello", "hey", "thanks", "thank",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function detectIntents(tokens: string[]): string[] {
  const hits = new Set<string>();
  for (const [intent, words] of Object.entries(INTENT_KEYWORDS)) {
    for (const w of words) {
      if (tokens.some((t) => t === w || w.includes(t) || t.includes(w))) {
        hits.add(intent);
        break;
      }
    }
  }
  return [...hits];
}

function scoreBusiness(
  business: BusinessRow,
  services: ServiceRow[],
  tokens: string[],
  intents: string[],
): { score: number; matchedServices: ServiceRow[] } {
  let score = 0;
  const matched: ServiceRow[] = [];

  // industry match
  const industry = business.industry?.toLowerCase() ?? "";
  for (const intent of intents) {
    if (industry.includes(intent) || intent.includes(industry)) score += 5;
  }

  // name match
  const name = business.name.toLowerCase();
  for (const t of tokens) {
    if (name.includes(t)) score += 3;
  }

  // service match
  for (const svc of services) {
    let svcScore = 0;
    const blob = `${svc.name} ${svc.description ?? ""}`.toLowerCase();
    for (const t of tokens) {
      if (blob.includes(t)) svcScore += 2;
    }
    if (svcScore > 0) {
      matched.push(svc);
      score += svcScore;
    }
  }

  return { score, matchedServices: matched.slice(0, 3) };
}

const PRESET_REPLIES: Array<{ test: RegExp; reply: string }> = [
  { test: /^(hi|hello|hey|yo|hola)\b/i, reply: "Hey! What kind of place are you looking for? A gym, salon, clinic, yoga studio…?" },
  { test: /\b(thanks|thank you|cheers|appreciate)\b/i, reply: "Anytime — happy booking." },
  { test: /\bhelp\b/i, reply: "Sure — tell me what you need (e.g. \"haircut tomorrow\" or \"yoga class tonight\") and I'll point you to a place." },
];

export function localConciergeReply(query: string, ctx: ConciergeContext): ConciergeReply {
  const trimmed = query.trim();
  if (!trimmed) {
    return { message: "Tell me what you're looking for and I'll find a place.", matches: [] };
  }

  // small-talk handler
  for (const { test, reply } of PRESET_REPLIES) {
    if (test.test(trimmed)) {
      return { message: reply, matches: [] };
    }
  }

  const tokens = tokenize(trimmed);
  const intents = detectIntents(tokens);

  const ranked: ConciergeMatch[] = ctx.businesses
    .map((b) => {
      const services = ctx.servicesByBusiness[b.id] ?? [];
      const { score, matchedServices } = scoreBusiness(b, services, tokens, intents);
      return { business: b, matchedServices, score };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (ranked.length === 0) {
    const list = ctx.businesses.slice(0, 4).map((b) => ({
      business: b,
      matchedServices: (ctx.servicesByBusiness[b.id] ?? []).slice(0, 2),
      score: 0,
    }));
    return {
      message:
        "I didn't quite catch that, but here are a few places you can browse. Try something like \"haircut\", \"personal training\", or \"yoga class\".",
      matches: list,
    };
  }

  const top = ranked[0];
  const intentLabel = intents[0] ?? top.business.industry;
  const message =
    ranked.length === 1
      ? `Found one match for "${intentLabel}". Tap to start booking.`
      : `Found ${ranked.length} places that look right. Top pick first:`;

  const followUp =
    top.matchedServices.length > 0
      ? `Try "${top.matchedServices[0].name}" at ${top.business.name}.`
      : undefined;

  return { message, matches: ranked, followUp };
}
