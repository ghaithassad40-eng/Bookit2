import { useQuery } from "@tanstack/react-query";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { BusinessRow } from "@/lib/database.types";
import { DEMO_BUSINESSES } from "@/lib/demoData";

export function useAdminBusinesses(userId: string | null) {
  return useQuery({
    queryKey: ["admin-businesses", userId],
    queryFn: async (): Promise<BusinessRow[]> => {
      if (!userId) return [];
      // Demo user → expose all demo businesses as if they own them.
      if (userId.startsWith("demo-") || !isSupabaseConfigured) {
        return DEMO_BUSINESSES;
      }
      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BusinessRow[];
    },
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
}
