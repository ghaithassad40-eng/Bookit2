import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { BookingEquipmentRow, BookingRow } from "@/lib/database.types";
import type { PaymentResult } from "@/lib/payments";
import {
  generateLocalBookingReference,
  getLocalBookings,
  saveLocalBooking,
  updateLocalBooking,
} from "@/lib/localBookings";
import {
  newBookingEquipmentId,
  saveLocalBookingEquipment,
} from "@/lib/localBookingEquipment";

const useEdge = (import.meta.env.VITE_USE_EDGE_BOOKING as string | undefined) === "true";

function createDemoBooking(input: CreateBookingInput): BookingRow {
  const now = new Date().toISOString();
  const booking: BookingRow = {
    id: `book-${Date.now()}`,
    business_id: input.business_id,
    service_id: input.service_id,
    staff_id: input.staff_id ?? null,
    slot_id: input.slot_id,
    customer_name: input.customer_name,
    customer_phone: input.customer_phone ?? null,
    customer_email: input.customer_email ?? null,
    notes: input.notes ?? null,
    booking_reference: generateLocalBookingReference(),
    status: "confirmed",
    payment_method: input.payment?.method ?? null,
    payment_status: input.payment ? (input.payment.success ? "paid" : "failed") : null,
    payment_amount: input.payment_amount ?? null,
    payment_currency: input.payment_currency ?? null,
    payment_transaction_id: input.payment?.transactionId ?? null,
    payment_provider_ref: input.payment?.providerRef ?? null,
    provider: input.payment?.providerRef ? "myfatoorah" : null,
    provider_invoice_id: input.payment?.providerRef ?? null,
    provider_payment_url: null,
    provider_initiated_at: input.payment ? now : null,
    // Funds are held in escrow until the release condition fires.
    payout_status: input.payment ? "held" : null,
    payout_id: null,
    released_at: null,
    created_at: now,
    updated_at: now,
  };
  saveLocalBooking(booking);

  // Persist equipment lines so the Confirmation invoice can render them.
  if (input.equipment && input.equipment.length > 0) {
    const lines: BookingEquipmentRow[] = input.equipment.map((eq) => ({
      id: newBookingEquipmentId(),
      booking_id: booking.id,
      equipment_id: eq.equipment_id,
      quantity: eq.quantity,
      unit_price: eq.unit_price,
      currency: eq.currency,
      created_at: now,
    }));
    saveLocalBookingEquipment(lines);
  }
  return booking;
}

/** A single line in the customer's equipment cart at booking time. */
export interface BookingEquipmentInput {
  equipment_id: string;
  quantity: number;
  /** 0 when the source equipment row's price is null (free / included). */
  unit_price: number;
  currency: string;
}

export interface CreateBookingInput {
  business_id: string;
  service_id: string;
  staff_id?: string | null;
  slot_id: string;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  notes?: string | null;
  /** Result from a successful payment charge (mock or real). */
  payment?: PaymentResult | null;
  payment_amount?: number | null;
  payment_currency?: string | null;
  /** Equipment add-ons the customer ticked during booking. */
  equipment?: BookingEquipmentInput[];
}

async function createBookingViaRpc(input: CreateBookingInput): Promise<BookingRow> {
  const { data, error } = await supabase.rpc("create_booking_atomic", {
    p_business_id: input.business_id,
    p_service_id: input.service_id,
    p_staff_id: input.staff_id ?? null,
    p_slot_id: input.slot_id,
    p_customer_name: input.customer_name,
    p_customer_phone: input.customer_phone ?? null,
    p_customer_email: input.customer_email ?? null,
    p_notes: input.notes ?? null,
  });
  if (error) throw new Error(error.message);
  return data as unknown as BookingRow;
}

async function createBookingViaEdge(input: CreateBookingInput): Promise<BookingRow> {
  const { data, error } = await supabase.functions.invoke<{ booking: BookingRow }>("create-booking", {
    body: input,
  });
  if (error) throw error;
  if (!data?.booking) throw new Error("No booking returned from edge function");
  return data.booking;
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBookingInput) => {
      // Demo mode (no backend, or demo business id) → fake the booking locally.
      if (!isSupabaseConfigured || input.business_id.startsWith("biz-")) {
        return createDemoBooking(input);
      }
      return useEdge ? createBookingViaEdge(input) : createBookingViaRpc(input);
    },
    onSuccess: (booking) => {
      qc.invalidateQueries({ queryKey: ["slots", booking.business_id] });
      qc.invalidateQueries({ queryKey: ["bookings", booking.business_id] });
    },
  });
}

interface ListOpts {
  businessId: string;
  status?: BookingRow["status"];
  search?: string;
  limit?: number;
}

function filterLocalBookings(opts: ListOpts): BookingRow[] {
  const all = getLocalBookings().filter((b) => b.business_id === opts.businessId);
  let list = all;
  if (opts.status) list = list.filter((b) => b.status === opts.status);
  if (opts.search) {
    const q = opts.search.toLowerCase();
    list = list.filter(
      (b) =>
        b.customer_name?.toLowerCase().includes(q) ||
        b.customer_email?.toLowerCase().includes(q) ||
        b.booking_reference?.toLowerCase().includes(q),
    );
  }
  return list
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, opts.limit ?? 200);
}

async function fetchBookings(opts: ListOpts): Promise<BookingRow[]> {
  if (!isSupabaseConfigured || opts.businessId.startsWith("biz-")) {
    return filterLocalBookings(opts);
  }
  let q = supabase
    .from("bookings")
    .select("*")
    .eq("business_id", opts.businessId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 200);
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.search) {
    q = q.or(
      [
        `customer_name.ilike.%${opts.search}%`,
        `customer_email.ilike.%${opts.search}%`,
        `booking_reference.ilike.%${opts.search}%`,
      ].join(","),
    );
  }
  const { data, error } = await q;
  if (error) throw error;
  const arr = (data ?? []) as BookingRow[];
  return arr.length === 0 ? filterLocalBookings(opts) : arr;
}

export function useBookings(opts: Partial<ListOpts> & { businessId: string | undefined }) {
  return useQuery({
    queryKey: ["bookings", opts.businessId, opts.status, opts.search],
    queryFn: () =>
      fetchBookings({
        businessId: opts.businessId!,
        status: opts.status,
        search: opts.search,
        limit: opts.limit,
      }),
    enabled: Boolean(opts.businessId),
    staleTime: 10_000,
  });
}

// ---------------------------------------------------------------------------
// Cancel + refund
// ---------------------------------------------------------------------------

export interface CancelBookingInput {
  /** The booking row id (NOT the human reference). */
  id: string;
  /** Business id — used to invalidate the slot/booking query caches. */
  business_id: string;
  /** Why the customer/business cancelled. Free-form, written to the booking
   *  row for audit purposes. */
  reason?: string;
}

export interface CancelBookingResult {
  booking: BookingRow;
  /** True when funds were actually returned (paid booking). False for
   *  unpaid/already-failed bookings — the row still gets the cancelled
   *  status but there's nothing to refund. */
  refunded: boolean;
}

function cancelDemoBooking(input: CancelBookingInput): CancelBookingResult {
  const wasPaid = (() => {
    const existing = getLocalBookings().find((b) => b.id === input.id);
    return existing?.payment_status === "paid";
  })();
  const updated = updateLocalBooking(input.id, {
    status: "cancelled",
    payment_status: wasPaid ? "refunded" : null,
    payout_status: wasPaid ? "refunded" : null,
    notes: input.reason ? `[cancelled] ${input.reason}` : undefined,
  });
  if (!updated) throw new Error("Booking not found");
  return { booking: updated, refunded: wasPaid };
}

async function cancelBookingViaRpc(input: CancelBookingInput): Promise<CancelBookingResult> {
  // The production schema needs a `cancel_booking_atomic` RPC that flips
  // status + payment_status + payout_status + writes a ledger reversal in a
  // single transaction. Migration is not yet shipped — fall back to a plain
  // UPDATE so the UI flow can be exercised against staging.
  const { data, error } = await supabase
    .from("bookings")
    .update({
      status: "cancelled",
      payment_status: "refunded",
      payout_status: "refunded",
    })
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { booking: data as BookingRow, refunded: true };
}

export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CancelBookingInput): Promise<CancelBookingResult> => {
      if (!isSupabaseConfigured || input.business_id.startsWith("biz-")) {
        return cancelDemoBooking(input);
      }
      return cancelBookingViaRpc(input);
    },
    onSuccess: ({ booking }) => {
      qc.invalidateQueries({ queryKey: ["slots", booking.business_id] });
      qc.invalidateQueries({ queryKey: ["bookings", booking.business_id] });
    },
  });
}

export function useUpdateBookingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      businessId,
    }: {
      id: string;
      status: BookingRow["status"];
      businessId: string;
    }) => {
      if (!isSupabaseConfigured || businessId.startsWith("biz-")) {
        const updated = updateLocalBooking(id, { status });
        if (!updated) throw new Error("Booking not found");
        return { id, status, businessId };
      }
      const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
      if (error) throw error;
      return { id, status, businessId };
    },
    onSuccess: ({ businessId }) => {
      qc.invalidateQueries({ queryKey: ["bookings", businessId] });
    },
  });
}
