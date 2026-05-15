import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BusinessRow, BusinessStatus } from "@/lib/database.types";
import { DEMO_BUSINESSES } from "@/lib/demoData";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

/** Local override layer for the demo dataset — DEMO_BUSINESSES is exported
 *  `const` and shouldn't be mutated, so platform-admin status changes land
 *  in this localStorage map and merge in at read time. Production uses
 *  Supabase, where the businesses table is the source of truth. */
const OVERRIDES_KEY = "bookit.demo.platform.business_overrides";

interface BusinessOverride {
  status?: BusinessStatus;
  rejection_reason?: string | null;
}

function readOverrides(): Record<string, BusinessOverride> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(OVERRIDES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, BusinessOverride>) : {};
  } catch {
    return {};
  }
}

function writeOverrides(overrides: Record<string, BusinessOverride>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
}

/** Apply demo overrides on top of the seeded list. Used by both the read
 *  query here and (transitively) the existing useBusiness lookups so the
 *  vendor's own admin shell reflects platform-admin actions instantly. */
export function applyBusinessOverrides(list: BusinessRow[]): BusinessRow[] {
  const overrides = readOverrides();
  if (Object.keys(overrides).length === 0) return list;
  return list.map((b) => {
    const o = overrides[b.id];
    if (!o) return b;
    return {
      ...b,
      status: o.status ?? b.status,
      rejection_reason:
        "rejection_reason" in o ? o.rejection_reason ?? null : b.rejection_reason,
    };
  });
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function usePlatformBusinesses() {
  return useQuery<BusinessRow[]>({
    queryKey: ["platform-businesses"],
    staleTime: 10_000,
    queryFn: async () => {
      if (!isSupabaseConfigured) return applyBusinessOverrides(DEMO_BUSINESSES);
      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows = (data ?? []) as BusinessRow[];
      return rows.length > 0 ? rows : applyBusinessOverrides(DEMO_BUSINESSES);
    },
  });
}

export interface UpdateBusinessStatusInput {
  id: string;
  status: BusinessStatus;
  rejection_reason?: string | null;
}

export function useUpdateBusinessStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateBusinessStatusInput) => {
      if (!isSupabaseConfigured || input.id.startsWith("biz-")) {
        const overrides = readOverrides();
        overrides[input.id] = {
          status: input.status,
          rejection_reason: input.rejection_reason ?? null,
        };
        writeOverrides(overrides);
        return { id: input.id, status: input.status };
      }
      const { error } = await supabase
        .from("businesses")
        .update({
          status: input.status,
          rejection_reason: input.rejection_reason ?? null,
        })
        .eq("id", input.id);
      if (error) throw error;
      return { id: input.id, status: input.status };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-businesses"] });
      qc.invalidateQueries({ queryKey: ["business"] });
      qc.invalidateQueries({ queryKey: ["concierge-context"] });
    },
  });
}
