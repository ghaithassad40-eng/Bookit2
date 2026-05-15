import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { BusinessRow, EquipmentRow, ServiceRow } from "@/lib/database.types";
import type { ConciergeContext } from "@/lib/concierge";
import { DEMO_BUSINESSES, DEMO_EQUIPMENT, DEMO_SERVICES } from "@/lib/demoData";
import { applyBusinessOverrides } from "@/hooks/usePlatformBusinesses";

/** Approval gate — never surface unapproved businesses in the concierge.
 *  Rows without `status` (legacy prod data) are treated as approved. */
function onlyApproved(businesses: BusinessRow[]): BusinessRow[] {
  return businesses.filter((b) => !b.status || b.status === "approved");
}

function buildIndex(
  businesses: BusinessRow[],
  services: ServiceRow[],
  equipment: EquipmentRow[],
): ConciergeContext {
  const approved = onlyApproved(businesses);
  const approvedIds = new Set(approved.map((b) => b.id));
  const servicesByBusiness: Record<string, ServiceRow[]> = {};
  for (const svc of services) {
    if (!approvedIds.has(svc.business_id)) continue;
    (servicesByBusiness[svc.business_id] ||= []).push(svc);
  }
  const equipmentFiltered = equipment.filter(
    (e) => e.is_active && approvedIds.has(e.business_id),
  );
  return { businesses: approved, servicesByBusiness, equipment: equipmentFiltered };
}

function buildDemoContext(): ConciergeContext {
  return buildIndex(
    applyBusinessOverrides(DEMO_BUSINESSES),
    DEMO_SERVICES.filter((s) => s.is_active),
    DEMO_EQUIPMENT.filter((e) => e.is_active),
  );
}

/**
 * Loads every active business + its services in one shot so the concierge can
 * match locally without round-trips. Falls back to the demo dataset when
 * Supabase isn't configured or returns nothing.
 */
export function useConciergeContext() {
  return useQuery<ConciergeContext>({
    queryKey: ["concierge-context"],
    staleTime: 60_000,
    queryFn: async () => {
      if (!isSupabaseConfigured) return buildDemoContext();

      const [
        { data: businesses, error: bErr },
        { data: services, error: sErr },
        { data: equipment, error: eErr },
      ] = await Promise.all([
        supabase
          .from("businesses")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("services")
          .select("*")
          .eq("is_active", true)
          .limit(500),
        supabase
          .from("equipment")
          .select("*")
          .eq("is_active", true)
          .limit(1000),
      ]);

      if (bErr) throw bErr;
      if (sErr) throw sErr;
      // Equipment table may not exist yet in older Supabase projects — treat
      // an error here as "no equipment" rather than failing the whole query.
      const eqRows = !eErr && equipment ? ((equipment ?? []) as EquipmentRow[]) : [];

      const list = (businesses ?? []) as BusinessRow[];
      if (list.length === 0) return buildDemoContext();

      const svcRows = (services ?? []) as ServiceRow[];
      return buildIndex(list, svcRows, eqRows);
    },
  });
}
