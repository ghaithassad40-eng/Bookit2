import { useMutation } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { BusinessRow, EquipmentRow } from "@/lib/database.types";
import {
  searchEquipmentLocally,
  type EquipmentSearchMatch,
} from "@/lib/equipmentSearch";
import { DEMO_BUSINESSES, DEMO_EQUIPMENT } from "@/lib/demoData";
import { fetchAllEquipment } from "@/hooks/useEquipment";

interface EdgeMatchResponse {
  success: boolean;
  matches?: Array<{
    business_id: string;
    score: number;
    reason: string;
    equipment_ids: string[];
  }>;
  error?: string;
}

interface SearchInput {
  query: string;
  country?: string;
  language_hint?: "en" | "ar";
}

/** Single-result row returned to the UI — combines the LLM/local score with
 *  the resolved business + the matched equipment objects. */
export interface EquipmentSearchResult extends EquipmentSearchMatch {
  reason?: string;
  /** "ai" when the result came from the LLM, "local" when we fell back. */
  source: "ai" | "local";
}

/**
 * Equipment-search mutation. Tries the Edge Function first; on any error
 * (no API key, network issue, or non-200 response), silently falls back to
 * the local keyword matcher so the demo never breaks.
 */
export function useEquipmentSearch() {
  return useMutation({
    mutationFn: async (input: SearchInput): Promise<EquipmentSearchResult[]> => {
      const q = input.query.trim();
      if (!q) return [];

      // Always have a catalog ready for the local fallback.
      const [allEquipment, allBusinesses] = await Promise.all([
        fetchAllEquipment(),
        fetchAllBusinesses(),
      ]);

      // Try the Edge Function only when Supabase is wired up.
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase.functions.invoke<EdgeMatchResponse>(
            "ai-equipment-search",
            { body: input },
          );
          if (!error && data?.success && data.matches?.length) {
            return mapEdgeMatches(data.matches, allEquipment, allBusinesses);
          }
        } catch {
          // Swallow — fall through to local matcher.
        }
      }

      return searchEquipmentLocally(q, allEquipment, allBusinesses).map((m) => ({
        ...m,
        source: "local" as const,
      }));
    },
  });
}

function mapEdgeMatches(
  matches: NonNullable<EdgeMatchResponse["matches"]>,
  equipment: EquipmentRow[],
  businesses: BusinessRow[],
): EquipmentSearchResult[] {
  const businessById = new Map(businesses.map((b) => [b.id, b]));
  const equipmentById = new Map(equipment.map((e) => [e.id, e]));
  const out: EquipmentSearchResult[] = [];
  for (const m of matches) {
    const business = businessById.get(m.business_id);
    if (!business) continue;
    const matched = m.equipment_ids
      .map((id) => {
        const eq = equipmentById.get(id);
        return eq ? { equipment: eq, score: m.score, reason: m.reason } : null;
      })
      .filter((x): x is { equipment: EquipmentRow; score: number; reason: string } => x !== null);
    out.push({
      business,
      matchedEquipment: matched,
      score: m.score,
      reason: m.reason,
      source: "ai",
    });
  }
  return out;
}

async function fetchAllBusinesses(): Promise<BusinessRow[]> {
  if (!isSupabaseConfigured) return [...DEMO_BUSINESSES];
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("status", "approved");
  if (error) return [...DEMO_BUSINESSES];
  const arr = (data ?? []) as BusinessRow[];
  return arr.length === 0 ? [...DEMO_BUSINESSES] : arr;
}

// Re-export the demo catalogs so consumers can sanity-check without importing
// from demoData directly.
export { DEMO_EQUIPMENT };
