import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { TimeSlotRow } from "@/lib/database.types";
import { generateDemoSlots } from "@/lib/demoData";
import { getLocalBookings } from "@/lib/localBookings";

interface SlotQuery {
  businessId: string;
  serviceId?: string | null;
  staffId?: string | null;
  fromDate?: Date;
  toDate?: Date;
}

function applyLocalBookings(slots: TimeSlotRow[], businessId: string): TimeSlotRow[] {
  const bookings = getLocalBookings().filter((b) => b.business_id === businessId);
  if (bookings.length === 0) return slots;
  const counts = new Map<string, number>();
  for (const b of bookings) counts.set(b.slot_id, (counts.get(b.slot_id) ?? 0) + 1);
  return slots.map((s) => {
    const extra = counts.get(s.id) ?? 0;
    if (extra === 0) return s;
    const bookedCount = Math.min(s.capacity, s.booked_count + extra);
    return {
      ...s,
      booked_count: bookedCount,
      status: bookedCount >= s.capacity ? "full" : s.status,
    };
  });
}

function getDemoSlotsFiltered(q: SlotQuery): TimeSlotRow[] {
  let slots = generateDemoSlots(q.businessId);
  if (q.serviceId) slots = slots.filter((s) => s.service_id === q.serviceId);
  if (q.staffId) slots = slots.filter((s) => s.staff_id === q.staffId);
  return applyLocalBookings(slots, q.businessId);
}

async function fetchSlots(q: SlotQuery): Promise<TimeSlotRow[]> {
  if (!isSupabaseConfigured || q.businessId.startsWith("biz-")) {
    return getDemoSlotsFiltered(q);
  }
  let query = supabase
    .from("time_slots")
    .select("*")
    .eq("business_id", q.businessId)
    .gte("start_time", (q.fromDate ?? new Date()).toISOString())
    .order("start_time", { ascending: true })
    .limit(500);
  if (q.serviceId) query = query.eq("service_id", q.serviceId);
  if (q.staffId) query = query.eq("staff_id", q.staffId);
  if (q.toDate) query = query.lte("start_time", q.toDate.toISOString());
  const { data, error } = await query;
  if (error) throw error;
  const arr = (data ?? []) as TimeSlotRow[];
  return arr.length === 0 ? getDemoSlotsFiltered(q) : arr;
}

export function useSlots(query: Partial<SlotQuery> & { businessId: string | undefined }) {
  const qc = useQueryClient();
  const key = ["slots", query.businessId, query.serviceId, query.staffId, query.fromDate?.toISOString()];

  const result = useQuery({
    queryKey: key,
    queryFn: () =>
      fetchSlots({
        businessId: query.businessId!,
        serviceId: query.serviceId,
        staffId: query.staffId,
        fromDate: query.fromDate,
        toDate: query.toDate,
      }),
    enabled: Boolean(query.businessId),
    staleTime: 10_000,
  });

  // realtime updates on slots for this business (only when Supabase is wired up)
  useEffect(() => {
    if (!query.businessId) return;
    if (!isSupabaseConfigured || query.businessId.startsWith("biz-")) return;
    const channel = supabase
      .channel(`slots:${query.businessId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "time_slots",
          filter: `business_id=eq.${query.businessId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["slots", query.businessId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [query.businessId, qc]);

  return result;
}
