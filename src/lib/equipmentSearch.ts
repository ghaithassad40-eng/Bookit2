import type { BusinessRow, EquipmentRow } from "./database.types";

/**
 * Local-only equipment search. Used as the deterministic fallback for the
 * AI search when Supabase isn't configured (demo mode) — and also as the
 * authoritative source-of-truth that the Edge Function ranks against
 * server-side, so the demo experience and production stay close.
 *
 * Matching strategy
 * -----------------
 * 1. Tokenize the query — strip punctuation, fold Arabic diacritics, split
 *    on whitespace. Drop stop words ("a", "the", "and", "with", "I", "need").
 * 2. For every equipment row, score = number of tokens that match the row's
 *    name + name_ar + description + features array (lowercased substring
 *    match). Numeric-tokens like "4k" or "27-inch" match even when embedded
 *    in feature tags.
 * 3. Aggregate per-business: business_score = sum of its top-3 equipment
 *    scores. Drop businesses with score 0.
 * 4. Return matches sorted by business_score desc, then by approved-status,
 *    then by name.
 */

export interface EquipmentSearchMatch {
  business: BusinessRow;
  matchedEquipment: Array<{ equipment: EquipmentRow; score: number; reason: string }>;
  score: number;
}

const STOP_WORDS = new Set([
  // English
  "a", "an", "the", "and", "or", "but", "with", "without", "for", "of", "in",
  "on", "at", "to", "is", "are", "be", "i", "you", "we", "my", "me", "need",
  "want", "looking", "find", "show", "any", "some", "please", "thanks",
  // Arabic stopwords
  "في", "من", "إلى", "على", "أن", "أنا", "أنت", "نحن", "أريد", "أحتاج",
  "ابحث", "أبحث", "أي", "بعض",
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    // Strip Arabic diacritics
    .replace(/[ً-ٰٟ]/g, "")
    // Replace punctuation with spaces (keep dashes since "4k", "27-inch" matter)
    .replace(/[^\w؀-ۿ\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(query: string): string[] {
  const normalized = normalize(query);
  return normalized
    .split(" ")
    .filter((t) => t.length > 0 && !STOP_WORDS.has(t));
}

/** Per-equipment match scorer. Returns 0 when nothing matches. */
function scoreEquipment(
  equipment: EquipmentRow,
  tokens: string[],
): { score: number; reason: string } {
  if (tokens.length === 0) return { score: 0, reason: "" };
  const haystackParts: string[] = [
    equipment.name,
    equipment.name_ar ?? "",
    equipment.description ?? "",
    equipment.description_ar ?? "",
    ...equipment.features,
  ];
  const haystack = haystackParts.map(normalize).join(" ");
  let score = 0;
  const hits: string[] = [];
  for (const token of tokens) {
    if (!token) continue;
    // Exact feature-tag match scores higher than substring match.
    if (equipment.features.some((f) => normalize(f) === token)) {
      score += 3;
      hits.push(token);
      continue;
    }
    // Substring in any field (catches "monitor" inside "4K External Monitor").
    if (haystack.includes(token)) {
      score += 1;
      hits.push(token);
    }
  }
  return { score, reason: hits.join(", ") };
}

export function searchEquipmentLocally(
  query: string,
  equipment: EquipmentRow[],
  businesses: BusinessRow[],
): EquipmentSearchMatch[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  // Score every equipment row, group by business.
  const businessMap = new Map<string, EquipmentSearchMatch>();
  const businessById = new Map(businesses.map((b) => [b.id, b]));

  for (const row of equipment) {
    const business = businessById.get(row.business_id);
    if (!business) continue;
    // Skip non-approved businesses so the search respects the marketplace
    // approval gate (matches the public landing rules).
    if (business.status && business.status !== "approved") continue;

    const { score, reason } = scoreEquipment(row, tokens);
    if (score === 0) continue;

    const existing = businessMap.get(row.business_id);
    if (existing) {
      existing.matchedEquipment.push({ equipment: row, score, reason });
    } else {
      businessMap.set(row.business_id, {
        business,
        matchedEquipment: [{ equipment: row, score, reason }],
        score: 0, // recomputed below
      });
    }
  }

  // Aggregate per-business: business_score = top-3 equipment scores summed.
  const results = Array.from(businessMap.values()).map((m) => {
    const sorted = [...m.matchedEquipment].sort((a, b) => b.score - a.score);
    const topThree = sorted.slice(0, 3);
    return {
      business: m.business,
      matchedEquipment: sorted,
      score: topThree.reduce((sum, e) => sum + e.score, 0),
    };
  });

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.business.name.localeCompare(b.business.name);
  });

  return results;
}
