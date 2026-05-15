import type { BusinessRow, EquipmentRow, ServiceRow } from "./database.types";
import type { Locale } from "./i18n";
import { searchEquipmentLocally } from "./equipmentSearch";

// ---------------------------------------------------------------------------
// Local concierge — keyword/intent matcher with conversational replies.
// Works with zero setup. The companion edge function (ai-concierge) can be
// swapped in for a real LLM by setting VITE_USE_AI_CONCIERGE=true.
// ---------------------------------------------------------------------------

export interface ConciergeContext {
  businesses: BusinessRow[];
  servicesByBusiness: Record<string, ServiceRow[]>;
  /** Flat catalog of every active equipment row across approved businesses.
   *  Used as a fall-through matcher when no service intent fires — so
   *  customers can ask "Samsung Monitor 27" curve" in the chat and still get
   *  matched to Meridian (instead of the random-browse fallback). */
  equipment: EquipmentRow[];
}

export interface ConciergeMatch {
  business: BusinessRow;
  matchedServices: ServiceRow[];
  /** Equipment items the user's query matched (populated only when the
   *  reply came from the equipment fall-through). */
  matchedEquipment?: EquipmentRow[];
  score: number;
}

export interface ConciergeReply {
  message: string;
  matches: ConciergeMatch[];
  followUp?: string;
  /** Tag describing where the matches came from so the UI / telemetry can
   *  distinguish a service match from an equipment match. */
  source?: "service" | "equipment" | "browse";
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
    "قدم", "خماسي", "سباعي", "مباراة",
  ],
  basketball: [
    "basketball", "basket", "hoops", "fullcourt", "halfcourt", "shoot", "dunk", "dribble",
    "سلة",
  ],
  padel: ["padel", "paddle", "racquet", "racket", "بادل", "مضرب"],
  cricket: ["cricket", "nets", "batting", "bowling", "wicket", "bowler", "batsman", "كريكت"],
};

// Generic "court/field/stadium" words in Arabic and English. They don't
// disambiguate a sport on their own — «ملعب» can mean a padel court, a
// basketball court, a football pitch or a cricket field. They are kept out of
// the per-intent keyword lists above and used only as a SPORT TRIGGER by the
// phrase scanner: when a generic word appears alongside a real sport keyword,
// we score that sport higher; when it appears alone, we surface every sport
// venue available in the region. Removing «ملعب» from the football-only list
// fixes the Arabic QA tour bug where every «ملعب …» query routed to football.
const GENERIC_SPORT_WORDS = new Set([
  "court", "field", "stadium", "pitch", "venue",
  "ملعب", "ملاعب", "ستاد",
]);

// Map of "sport tokens" to their intents — used by the phrase scanner so we
// can rank a specific sport above football when the user types things like
// «ملعب بادل» (padel court) or «basketball court».
const SPORT_PHRASE_TOKENS: Record<string, string> = {
  padel: "padel", بادل: "padel", paddle: "padel",
  basketball: "basketball", basket: "basketball", hoops: "basketball", سلة: "basketball",
  football: "football", soccer: "football", قدم: "football", خماسي: "football", سباعي: "football",
  cricket: "cricket", كريكت: "cricket",
};

// Localized human-readable label per intent. Used in the response message so
// 'Found one place for "football"' becomes 'Found one place for "كرة قدم"' in
// Arabic instead of leaking the raw English intent name.
export const INDUSTRY_LABELS: Record<string, { en: string; ar: string }> = {
  gym: { en: "gym", ar: "نادي رياضي" },
  salon: { en: "salon", ar: "صالون" },
  clinic: { en: "clinic", ar: "عيادة" },
  yoga: { en: "yoga", ar: "يوغا" },
  spa: { en: "spa", ar: "سبا" },
  barber: { en: "barber", ar: "حلاق" },
  tutor: { en: "tutor", ar: "مدرّس" },
  coworking: { en: "coworking", ar: "مساحة عمل مشتركة" },
  car: { en: "car service", ar: "خدمة سيارة" },
  photo: { en: "photo studio", ar: "استوديو تصوير" },
  football: { en: "football", ar: "كرة قدم" },
  basketball: { en: "basketball", ar: "كرة سلة" },
  padel: { en: "padel", ar: "بادل" },
  cricket: { en: "cricket", ar: "كريكت" },
};

function industryLabel(intent: string, locale: Locale): string {
  return INDUSTRY_LABELS[intent]?.[locale] ?? intent;
}

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

function detectIntents(tokens: string[]): { intents: string[]; sportSpecific: string | null } {
  const hits = new Set<string>();
  // Phrase pass: did the user name a specific sport? («ملعب بادل»/"basketball court")
  let sportSpecific: string | null = null;
  for (const tok of tokens) {
    const sport = SPORT_PHRASE_TOKENS[tok];
    if (sport) {
      sportSpecific = sport;
      hits.add(sport);
      break;
    }
  }
  // Token pass against per-intent keyword lists. Skip the generic court/field
  // words — those should not by themselves attach to a specific sport intent.
  for (const [intent, words] of Object.entries(INTENT_KEYWORDS)) {
    for (const w of words) {
      if (
        tokens.some(
          (t) =>
            !GENERIC_SPORT_WORDS.has(t) &&
            (t === w || w.includes(t) || t.includes(w)),
        )
      ) {
        hits.add(intent);
        break;
      }
    }
  }
  return { intents: [...hits], sportSpecific };
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
  // Used when the query didn't match a service but did match equipment add-ons
  // — e.g. "Samsung Monitor 27" curve" or "4K camera for Zoom". We surface the
  // vendor that offers that gear instead of falling back to random browse.
  equipmentMatch: (count: number) => ({
    en:
      count === 1
        ? "Looks like you're after equipment. One place offers that — tap to start booking:"
        : `Looks like you're after equipment. ${count} places offer that — top pick first:`,
    ar:
      count === 1
        ? "يبدو أنّك تبحث عن تجهيزات. مكان واحد يوفّرها — اضغط لبدء الحجز:"
        : `يبدو أنّك تبحث عن تجهيزات. ${count} أماكن توفّرها — الأنسب أولاً:`,
  }),
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
  const { intents, sportSpecific } = detectIntents(tokens);

  const ranked: ConciergeMatch[] = ctx.businesses
    .map((b) => {
      const services = ctx.servicesByBusiness[b.id] ?? [];
      let { score, matchedServices } = scoreBusiness(b, services, tokens, intents);
      // If the user named a specific sport, boost businesses whose industry
      // matches that sport so they outrank a generic-keyword match. Without
      // this boost, «ملعب بادل» (padel court) still ranks football pitches
      // high because they match the generic "ملعب" token.
      if (sportSpecific && b.industry?.toLowerCase() === sportSpecific) {
        score += 10;
      }
      return { business: b, matchedServices, score };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (ranked.length === 0) {
    // Service matcher missed — try the equipment matcher before falling
    // back to random browse. Customers asking "Samsung Monitor 27\" curve"
    // or "I need a whiteboard" should land on the vendor that offers it.
    const equipmentMatches = (ctx.equipment ?? []).length > 0
      ? searchEquipmentLocally(trimmed, ctx.equipment, ctx.businesses).slice(0, 4)
      : [];

    if (equipmentMatches.length > 0) {
      const matches: ConciergeMatch[] = equipmentMatches.map((m) => ({
        business: m.business,
        matchedServices: [],
        matchedEquipment: m.matchedEquipment.slice(0, 4).map((e) => e.equipment),
        score: m.score,
      }));
      return {
        message: REPLIES.equipmentMatch(matches.length)[locale],
        matches,
        source: "equipment",
      };
    }

    // Truly nothing matched — show the polite fallback with browse list.
    const list = ctx.businesses.slice(0, 4).map((b) => ({
      business: b,
      matchedServices: (ctx.servicesByBusiness[b.id] ?? []).slice(0, 2),
      score: 0,
    }));
    return { message: REPLIES.noMatch[locale], matches: list, source: "browse" };
  }

  const top = ranked[0];
  // Use the top business's actual industry, localized — so the message reads
  // 'Found one place for "padel"' in English and 'وجدت مكاناً واحداً لـ«بادل»'
  // in Arabic, instead of leaking the raw English intent name into Arabic.
  const rawIntent = top.business.industry || intents[0] || "place";
  const intentLabel = industryLabel(rawIntent, locale);
  const message =
    ranked.length === 1
      ? REPLIES.oneMatch(intentLabel)[locale]
      : REPLIES.multiMatch(ranked.length)[locale];

  const followUp =
    top.matchedServices.length > 0
      ? REPLIES.followUp(top.matchedServices[0].name, top.business.name)[locale]
      : undefined;

  return { message, matches: ranked, followUp, source: "service" };
}
