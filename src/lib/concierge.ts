import type { BusinessRow, ServiceRow } from "./database.types";
import type { Locale } from "./i18n";

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

// Map common customer intents → industry/service keywords.
// Lower-cased, ASCII-folded. Arabic terms included so customers can ask in
// Arabic without switching language.
const INTENT_KEYWORDS: Record<string, string[]> = {
  gym: [
    "gym", "workout", "training", "trainer", "fitness", "lift", "weights", "exercise", "hiit", "cardio", "muscle",
    "نادي", "رياضي", "صالة", "تمرين", "تدريب", "كروسفت", "لياقة",
  ],
  salon: [
    "salon", "haircut", "hair", "cut", "color", "stylist", "blowout", "balayage", "highlights", "barber", "beard",
    "صالون", "حلاقة", "شعر", "كوافير", "صبغة", "تسريحة", "حلاق",
  ],
  clinic: [
    "clinic", "doctor", "physician", "appointment", "visit", "checkup", "physical", "health", "medical", "consult",
    "عيادة", "طبيب", "دكتور", "كشف", "فحص", "موعد", "استشارة",
  ],
  yoga: [
    "yoga", "stretch", "flow", "vinyasa", "yin", "meditation", "mindful", "breath",
    "يوغا", "تأمل", "استرخاء", "بيلاتس", "تنفس",
  ],
  spa: ["spa", "massage", "relax", "facial", "treatment", "سبا", "مساج", "تدليك", "وجه"],
  barber: ["barber", "beard", "shave", "حلاق", "حلاقة", "ذقن"],
  tutor: ["tutor", "lesson", "study", "homework", "math", "english", "درس", "مدرس", "دروس"],
  coworking: ["coworking", "desk", "office", "workspace", "مكتب", "مساحة عمل"],
  car: ["car", "auto", "wash", "service", "oil change", "tire", "سيارة", "غسيل", "زيت"],
  photo: ["photo", "shoot", "portrait", "headshot", "photography", "تصوير", "صور"],
  // Sports
  football: [
    "football", "soccer", "5v5", "7v7", "5aside", "7aside", "pitch", "turf", "futsal", "match", "kickabout", "goalkeeper", "striker",
    "كرة", "قدم", "ملعب", "خماسي", "سباعي", "مباراة",
  ],
  basketball: [
    "basketball", "basket", "hoops", "fullcourt", "halfcourt", "court", "shoot", "dunk", "dribble",
    "سلة", "كرة السلة",
  ],
  padel: ["padel", "paddle", "racquet", "racket", "بادل", "تنس", "مضرب"],
  cricket: ["cricket", "nets", "batting", "bowling", "wicket", "bowler", "batsman", "كريكت"],
};

const STOPWORDS = new Set([
  // English
  "i", "a", "an", "the", "to", "for", "and", "or", "of", "in", "on",
  "is", "am", "are", "be", "do", "you", "me", "my", "want", "need", "looking",
  "would", "like", "can", "help", "find", "book", "get", "have", "any", "some",
  "please", "hi", "hello", "hey", "thanks", "thank",
  // Arabic
  "في", "على", "من", "إلى", "هل", "ما", "هو", "هي", "أنا", "أريد", "احتاج",
  "ابحث", "ابغى", "ابغي", "ابي", "حجز", "احجز", "موعد", "أو", "و",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    // Keep Latin letters, digits, and Arabic letters (U+0600–U+06FF + U+0750–U+077F).
    .replace(/[^a-z0-9؀-ۿݐ-ݿ\s]/g, " ")
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

interface PresetReply {
  test: RegExp;
  reply: { en: string; ar: string };
}

const PRESET_REPLIES: PresetReply[] = [
  {
    test: /^(hi|hello|hey|yo|hola|مرحبا|أهلا|اهلا|السلام)\b/i,
    reply: {
      en: "Hey! What kind of place are you looking for? A gym, salon, clinic, yoga studio…?",
      ar: "أهلاً! أيّ نوع مكان تبحث عنه؟ نادي رياضي، صالون، عيادة، استوديو يوغا…؟",
    },
  },
  {
    test: /\b(thanks|thank you|cheers|appreciate|شكرا|شكراً|مشكور)\b/i,
    reply: { en: "Anytime — happy booking.", ar: "في خدمتك — حجز موفق." },
  },
  {
    test: /\b(help|مساعدة|ساعدني|ساعدوني)\b/i,
    reply: {
      en: 'Sure — tell me what you need (e.g. "haircut tomorrow" or "yoga class tonight") and I\'ll point you to a place.',
      ar: "أكيد — اكتب لي ما تحتاج (مثلاً «حلاقة بكرة» أو «حصة يوغا الليلة») وأوصلك للمكان المناسب.",
    },
  },
];

const REPLIES = {
  empty: {
    en: "Tell me what you're looking for and I'll find a place.",
    ar: "اكتب لي ما تبحث عنه وسأجد لك المكان المناسب.",
  },
  noMatch: {
    en: 'I didn\'t quite catch that, but here are a few places you can browse. Try something like "haircut", "personal training", or "yoga class".',
    ar: "لم أفهم الطلب تماماً، لكن إليك بعض الأماكن للتصفّح. جرّب «حلاقة» أو «تدريب شخصي» أو «حصة يوغا».",
  },
  oneMatch: (intent: string) => ({
    en: `Found one match for "${intent}". Tap to start booking.`,
    ar: `وجدت مكاناً واحداً لـ«${intent}». اضغط لبدء الحجز.`,
  }),
  multiMatch: (count: number) => ({
    en: `Found ${count} places that look right. Top pick first:`,
    ar: `وجدت ${count} أماكن مناسبة. الأنسب أولاً:`,
  }),
  followUp: (service: string, business: string) => ({
    en: `Try "${service}" at ${business}.`,
    ar: `جرّب «${service}» في ${business}.`,
  }),
};

export function localConciergeReply(
  query: string,
  ctx: ConciergeContext,
  locale: Locale = "en",
): ConciergeReply {
  const trimmed = query.trim();
  if (!trimmed) {
    return { message: REPLIES.empty[locale], matches: [] };
  }

  // small-talk handler
  for (const { test, reply } of PRESET_REPLIES) {
    if (test.test(trimmed)) {
      return { message: reply[locale], matches: [] };
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
    return { message: REPLIES.noMatch[locale], matches: list };
  }

  const top = ranked[0];
  // Use the top business's actual industry — it's the most accurate label even
  // when the query happened to match a generic keyword like "ملعب"/"court" from
  // a different intent's keyword list.
  const intentLabel = top.business.industry || intents[0] || "place";
  const message =
    ranked.length === 1
      ? REPLIES.oneMatch(intentLabel)[locale]
      : REPLIES.multiMatch(ranked.length)[locale];

  const followUp =
    top.matchedServices.length > 0
      ? REPLIES.followUp(top.matchedServices[0].name, top.business.name)[locale]
      : undefined;

  return { message, matches: ranked, followUp };
}
