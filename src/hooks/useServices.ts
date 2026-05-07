import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { ServiceRow } from "@/lib/database.types";
import { getDemoServices } from "@/lib/demoData";

async function fetchServices(businessId: string, opts: { onlyActive?: boolean }) {
  if (!isSupabaseConfigured || businessId.startsWith("biz-")) {
    return getDemoServices(businessId, opts.onlyActive);
  }
  let q = supabase
    .from("services")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });
  if (opts.onlyActive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  // empty list → fall back to demo so the page is never blank in dev
  const arr = (data ?? []) as ServiceRow[];
  return arr.length === 0 ? getDemoServices(businessId, opts.onlyActive) : arr;
}

export function useServices(businessId: string | undefined, opts: { onlyActive?: boolean } = { onlyActive: true }) {
  return useQuery({
    queryKey: ["services", businessId, opts.onlyActive],
    queryFn: () => fetchServices(businessId!, opts),
    enabled: Boolean(businessId),
    staleTime: 30_000,
  });
}
