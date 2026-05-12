import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { BookingRow, BusinessRow, PayoutRow } from "@/lib/database.types";
import {
  autoReleaseDueBookings,
  getLocalLedger,
  getLocalPayouts,
  markBookingPayoutCompletedLocal,
  markPayoutTransferredLocal,
  releaseBookingPayoutLocal,
} from "@/lib/escrow";
import { DEMO_BUSINESSES } from "@/lib/demoData";
import { getLocalBookings } from "@/lib/localBookings";

function isDemoBusiness(businessId: string) {
  return businessId.startsWith("biz-");
}

async function fetchPayouts(businessId: string): Promise<PayoutRow[]> {
  if (!isSupabaseConfigured || isDemoBusiness(businessId)) {
    return getLocalPayouts(businessId).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }
  const { data, error } = await supabase
    .from("payouts")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as PayoutRow[];
}

export function usePayouts(businessId: string | undefined) {
  return useQuery({
    queryKey: ["payouts", businessId],
    queryFn: () => fetchPayouts(businessId!),
    enabled: Boolean(businessId),
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });
}

export function useReleasePayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      booking: BookingRow;
      business: BusinessRow;
      reason: "service_completed" | "auto_release" | "manual_override" | "cancellation_window_expired";
      actor: string;
    }) => {
      if (!isSupabaseConfigured || isDemoBusiness(input.business.id)) {
        const result = releaseBookingPayoutLocal(input);
        // Simulate PSP wire — short delay then mark transferred.
        await new Promise((r) => setTimeout(r, 600));
        const transferred = markPayoutTransferredLocal(
          result.payout.id,
          `MF-DEMO-${result.payout.id.slice(-6).toUpperCase()}`,
        );
        markBookingPayoutCompletedLocal(input.booking.id, result.payout.id);
        return transferred ?? result.payout;
      }
      const { data, error } = await supabase.rpc("release_booking_payout", {
        p_booking_id: input.booking.id,
        p_reason: input.reason,
        p_actor: input.actor,
      });
      if (error) throw error;
      return data as unknown as PayoutRow;
    },
    onSuccess: (payout) => {
      qc.invalidateQueries({ queryKey: ["payouts", payout.business_id] });
      qc.invalidateQueries({ queryKey: ["bookings", payout.business_id] });
    },
  });
}

/**
 * Background hook: every 30s, scan local bookings and release any whose
 * service window has ended + grace elapsed. Runs once on mount, then on
 * interval, then again on focus.
 */
export function useAutoReleaseScheduler() {
  const qc = useQueryClient();
  useEffect(() => {
    if (typeof window === "undefined") return;
    let alive = true;

    function run() {
      if (!alive) return;
      const bookings = getLocalBookings();
      if (bookings.length === 0) return;
      const slotEndByBookingId: Record<string, string> = {};
      // The slot_id we store on demo bookings doesn't map to slot.start/end
      // because slots are generated lazily. We'll just use created_at + 1h
      // as the demo end-of-service signal (see escrow.ts default).
      const run = autoReleaseDueBookings({
        businesses: DEMO_BUSINESSES,
        graceMinutes: 0,
        slotEndByBookingId,
      });
      if (run.released.length > 0) {
        const businessIds = new Set(run.released.map((p) => p.business_id));
        businessIds.forEach((id) => {
          qc.invalidateQueries({ queryKey: ["payouts", id] });
          qc.invalidateQueries({ queryKey: ["bookings", id] });
        });
      }
    }

    run();
    const i = window.setInterval(run, 30_000);
    const onFocus = () => run();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      window.clearInterval(i);
      window.removeEventListener("focus", onFocus);
    };
  }, [qc]);
}

export function useLedger(businessId: string | undefined) {
  return useQuery({
    queryKey: ["ledger", businessId],
    queryFn: async () => {
      if (!isSupabaseConfigured || !businessId || isDemoBusiness(businessId)) {
        return getLocalLedger(businessId);
      }
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(businessId),
  });
}
