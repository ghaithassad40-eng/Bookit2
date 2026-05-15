import { create } from "zustand";
import type { ServiceRow, StaffRow, TimeSlotRow } from "@/lib/database.types";
import type { PaymentMethodId, PaymentResult } from "@/lib/payments";

export type BookingStep =
  | "service"
  | "staff"
  | "slot"
  | "equipment"
  | "details"
  | "review"
  | "payment";

/** equipmentId → quantity. Quantity 0 / absent means "not selected". */
export type EquipmentCart = Record<string, number>;

interface BookingState {
  step: BookingStep;
  service: ServiceRow | null;
  staff: StaffRow | null;
  slot: TimeSlotRow | null;
  /** Per-business add-on selection — equipment id → quantity. */
  equipmentCart: EquipmentCart;
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
  setEquipmentQty: (equipmentId: string, qty: number) => void;
  clearEquipmentCart: () => void;
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
  equipmentCart: {},
  customer: initialCustomer,
  paymentMethod: null,
  paymentResult: null,
  setStep: (step) => set({ step }),
  setService: (service) =>
    set({ service, staff: null, slot: null, equipmentCart: {}, step: "staff" }),
  setStaff: (staff) => set({ staff, slot: null, step: "slot" }),
  // After picking a slot we land on the equipment shelf. Book.tsx will
  // auto-skip to "details" when the business has no equipment configured.
  setSlot: (slot) => set({ slot, step: "equipment" }),
  setEquipmentQty: (equipmentId, qty) =>
    set((s) => {
      const next = { ...s.equipmentCart };
      if (qty <= 0) {
        delete next[equipmentId];
      } else {
        next[equipmentId] = qty;
      }
      return { equipmentCart: next };
    }),
  clearEquipmentCart: () => set({ equipmentCart: {} }),
  setCustomer: (next) => set((s) => ({ customer: { ...s.customer, ...next } })),
  setPaymentMethod: (method) => set({ paymentMethod: method }),
  setPaymentResult: (result) => set({ paymentResult: result }),
  reset: () =>
    set({
      step: "service",
      service: null,
      staff: null,
      slot: null,
      equipmentCart: {},
      customer: initialCustomer,
      paymentMethod: null,
      paymentResult: null,
    }),
}));
