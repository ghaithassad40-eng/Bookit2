import type {
  BookingRulesJson,
  CopyJson,
  LayoutJson,
  ThemeJson,
} from "./database.types";

export const DEFAULT_THEME: ThemeJson = {
  mode: "dark",
  primaryColor: "#0B0B0F",
  accentColor: "#3B82F6",
  secondaryColor: "#10B981",
  fontFamily: "Inter",
  borderRadius: "2xl",
  cardStyle: "glass",
  animationStyle: "smooth",
};

export const DEFAULT_COPY: CopyJson = {
  heroTitle: "Book appointments instantly.",
  heroSubtitle: "A fast and modern booking experience for your customers.",
  ctaText: "Book Now",
  confirmationMessage: "Your booking has been confirmed.",
};

export const DEFAULT_RULES: BookingRulesJson = {
  allowStaffSelection: true,
  requirePhone: true,
  requireEmail: true,
  allowNotes: true,
  preventDoubleBooking: true,
  slotDurationMinutes: 60,
  maxAdvanceBookingDays: 30,
  cancellationWindowHours: 12,
};

export const DEFAULT_LAYOUT: LayoutJson = {
  showTestimonials: true,
  showStaff: true,
  showServicesPreview: true,
};

export function withDefaults<T extends object>(value: Partial<T> | null | undefined, defaults: T): T {
  return { ...defaults, ...(value ?? {}) } as T;
}
