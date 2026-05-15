import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { EquipmentRow } from "@/lib/database.types";
import { DEMO_EQUIPMENT } from "@/lib/demoData";
import {
  deleteLocalEquipment,
  getLocalEquipment,
  newEquipmentId,
  upsertLocalEquipment,
} from "@/lib/localEquipment";

interface ListOpts {
  onlyActive?: boolean;
}

async function fetchEquipment(
  businessId: string,
  opts: ListOpts,
): Promise<EquipmentRow[]> {
  // Demo seed for any biz-prefixed id (lines up with the rest of the
  // demoData fallback strategy used by services / staff).
  if (!isSupabaseConfigured || businessId.startsWith("biz-")) {
    return getLocalEquipment(businessId, opts.onlyActive ?? false);
  }
  let q = supabase
    .from("equipment")
    .select("*")
    .eq("business_id", businessId)
    .order("category", { ascending: true })
    .order("created_at", { ascending: true });
  if (opts.onlyActive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  const arr = (data ?? []) as EquipmentRow[];
  // Empty list → fall through to demo so the page is never blank in dev.
  return arr.length === 0 ? getLocalEquipment(businessId, opts.onlyActive ?? false) : arr;
}

export function useEquipment(
  businessId: string | undefined,
  opts: ListOpts = { onlyActive: false },
) {
  return useQuery({
    queryKey: ["equipment", businessId, opts.onlyActive],
    queryFn: () => fetchEquipment(businessId!, opts),
    enabled: Boolean(businessId),
    staleTime: 30_000,
  });
}

/** Fetch every equipment row across every business (used by the AI search
 *  to filter vendors). Falls back to the demo catalog when Supabase isn't
 *  configured. */
export async function fetchAllEquipment(): Promise<EquipmentRow[]> {
  if (!isSupabaseConfigured) return [...DEMO_EQUIPMENT];
  const { data, error } = await supabase
    .from("equipment")
    .select("*")
    .eq("is_active", true);
  if (error) throw error;
  const arr = (data ?? []) as EquipmentRow[];
  return arr.length === 0 ? [...DEMO_EQUIPMENT] : arr;
}

// ─── Mutations ─────────────────────────────────────────────────────────────

export interface EquipmentInput {
  id?: string;
  business_id: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  description_ar: string | null;
  category: string;
  price: number | null;
  currency: string;
  image_url: string | null;
  features: string[];
  max_per_booking: number;
  is_active: boolean;
}

export function useUpsertEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: EquipmentInput): Promise<EquipmentRow> => {
      const now = new Date().toISOString();
      if (!isSupabaseConfigured || input.business_id.startsWith("biz-")) {
        const id = input.id ?? newEquipmentId();
        const row: EquipmentRow = {
          id,
          business_id: input.business_id,
          name: input.name,
          name_ar: input.name_ar,
          description: input.description,
          description_ar: input.description_ar,
          category: input.category,
          price: input.price,
          currency: input.currency,
          image_url: input.image_url,
          features: input.features,
          max_per_booking: input.max_per_booking,
          is_active: input.is_active,
          created_at: now,
          updated_at: now,
        };
        return upsertLocalEquipment(row);
      }
      if (input.id) {
        const { data, error } = await supabase
          .from("equipment")
          .update(input)
          .eq("id", input.id)
          .select("*")
          .single();
        if (error) throw error;
        return data as EquipmentRow;
      }
      const { data, error } = await supabase
        .from("equipment")
        .insert(input)
        .select("*")
        .single();
      if (error) throw error;
      return data as EquipmentRow;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["equipment", row.business_id] });
    },
  });
}

export function useDeleteEquipment(businessId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!isSupabaseConfigured || businessId.startsWith("biz-")) {
        deleteLocalEquipment(id);
        return;
      }
      const { error } = await supabase.from("equipment").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["equipment", businessId] });
    },
  });
}

export function useToggleEquipmentActive(businessId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      if (!isSupabaseConfigured || businessId.startsWith("biz-")) {
        // Read-modify-write via the localStorage overlay.
        const current = getLocalEquipment(businessId, false).find((e) => e.id === id);
        if (!current) throw new Error("Equipment not found");
        return upsertLocalEquipment({ ...current, is_active });
      }
      const { data, error } = await supabase
        .from("equipment")
        .update({ is_active })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data as EquipmentRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["equipment", businessId] });
    },
  });
}
