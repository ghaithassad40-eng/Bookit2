import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { BusinessRow } from "@/lib/database.types";

export function useAdminBusinesses(userId: string | null) {
  return useQuery({
    queryKey: ["admin-businesses", userId],
    queryFn: async (): Promise<BusinessRow[]> => {
      if (!userId) return [];
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
