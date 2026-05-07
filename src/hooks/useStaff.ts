import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { StaffRow } from "@/lib/database.types";
import { getDemoStaff } from "@/lib/demoData";

async function fetchStaff(businessId: string, onlyActive: boolean) {
  if (!isSupabaseConfigured || businessId.startsWith("biz-")) {
    return getDemoStaff(businessId, onlyActive);
  }
  let q = supabase
    .from("staff")
    .select("*")
    .eq("business_id", businessId)
    .order("rating", { ascending: false });
  if (onlyActive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  const arr = (data ?? []) as StaffRow[];
  return arr.length === 0 ? getDemoStaff(businessId, onlyActive) : arr;
}

export function useStaff(businessId: string | undefined, onlyActive = true) {
  return useQuery({
    queryKey: ["staff", businessId, onlyActive],
    queryFn: () => fetchStaff(businessId!, onlyActive),
    enabled: Boolean(businessId),
    staleTime: 30_000,
  });
}
