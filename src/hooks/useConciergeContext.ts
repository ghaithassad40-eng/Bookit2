import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { BusinessRow, ServiceRow } from "@/lib/database.types";
import type { ConciergeContext } from "@/lib/concierge";
import { DEMO_BUSINESSES, DEMO_SERVICES } from "@/lib/demoData";

function buildIndex(businesses: BusinessRow[], services: ServiceRow[]): ConciergeContext {
  const servicesByBusiness: Record<string, ServiceRow[]> = {};
  for (const svc of services) {
    (servicesByBusiness[svc.business_id] ||= []).push(svc);
  }
  return { businesses, servicesByBusiness };
}

const DEMO_CONTEXT: ConciergeContext = buildIndex(
  DEMO_BUSINESSES,
  DEMO_SERVICES.filter((s) => s.is_active),
);

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
      if (!isSupabaseConfigured) return DEMO_CONTEXT;

      const [{ data: businesses, error: bErr }, { data: services, error: sErr }] = await Promise.all([
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
      ]);

      if (bErr) throw bErr;
      if (sErr) throw sErr;

      const list = (businesses ?? []) as BusinessRow[];
      if (list.length === 0) return DEMO_CONTEXT;

      const svcRows = (services ?? []) as ServiceRow[];
      return buildIndex(list, svcRows);
    },
  });
}
