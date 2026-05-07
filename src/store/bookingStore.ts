import { create } from "zustand";
import type { ServiceRow, StaffRow, TimeSlotRow } from "@/lib/database.types";
import type { PaymentMethodId, PaymentResult } from "@/lib/payments";

export type BookingStep = "service" | "staff" | "slot" | "details" | "review" | "payment";

interface BookingState {
  step: BookingStep;
  service: ServiceRow | null;
  staff: StaffRow | null;
  slot: TimeSlotRow | null;
  customer: {
    name: string;
    phone: string;
    email: string;
    notes: string;
  };
  paymentMethod: PaymentMethodId | null;
  paymentResult: PaymentResult | null;
  setStep: (step: BookingStep) => void;
  setService: (service: ServiceRow | null) => void;
  setStaff: (staff: StaffRow | null) => void;
  setSlot: (slot: TimeSlotRow | null) => void;
  setCustomer: (next: Partial<BookingState["customer"]>) => void;
  setPaymentMethod: (method: PaymentMethodId | null) => void;
  setPaymentResult: (result: PaymentResult | null) => void;
  reset: () => void;
}

const initialCustomer = { name: "", phone: "", email: "", notes: "" };

export const useBookingStore = create<BookingState>((set) => ({
  step: "service",
  service: null,
  staff: null,
  slot: null,
  customer: initialCustomer,
  paymentMethod: null,
  paymentResult: null,
  setStep: (step) => set({ step }),
  setService: (service) => set({ service, staff: null, slot: null, step: "staff" }),
  setStaff: (staff) => set({ staff, slot: null, step: "slot" }),
  setSlot: (slot) => set({ slot, step: "details" }),
  setCustomer: (next) => set((s) => ({ customer: { ...s.customer, ...next } })),
  setPaymentMethod: (method) => set({ paymentMethod: method }),
  setPaymentResult: (result) => set({ paymentResult: result }),
  reset: () =>
    set({
      step: "service",
      service: null,
      staff: null,
      slot: null,
      customer: initialCustomer,
      paymentMethod: null,
      paymentResult: null,
    }),
}));
