// Client-side demo dataset. Used as a fallback when Supabase isn't configured
// so the customer-facing experience (landing, concierge, booking, confirmation)
// works end-to-end without any backend setup.

import type {
  BusinessConfigRow,
  BusinessRow,
  ServiceRow,
  StaffRow,
  TimeSlotRow,
} from "./database.types";

// ---------------------------------------------------------------------------
// Businesses
// ---------------------------------------------------------------------------

const NOW = new Date().toISOString();

function row<T extends object>(extra: T) {
  return { created_at: NOW, updated_at: NOW, ...extra };
}

export const DEMO_BUSINESSES: BusinessRow[] = [
  row({
    id: "biz-pulse",
    name: "Pulse Athletic Club",
    slug: "pulse-athletic",
    industry: "gym",
    logo_url: null,
    owner_id: null,
    is_active: true,
  }),
  row({
    id: "biz-lumen",
    name: "Lumen Hair Studio",
    slug: "lumen-hair",
    industry: "salon",
    logo_url: null,
    owner_id: null,
    is_active: true,
  }),
  row({
    id: "biz-northgate",
    name: "Northgate Family Clinic",
    slug: "northgate-clinic",
    industry: "clinic",
    logo_url: null,
    owner_id: null,
    is_active: true,
  }),
  row({
    id: "biz-stillpoint",
    name: "Stillpoint Yoga",
    slug: "stillpoint-yoga",
    industry: "yoga",
    logo_url: null,
    owner_id: null,
    is_active: true,
  }),
];

// ---------------------------------------------------------------------------
// Configs (theme + copy + rules + layout per business)
// ---------------------------------------------------------------------------

export const DEMO_CONFIGS: BusinessConfigRow[] = [
  row({
    id: "cfg-pulse",
    business_id: "biz-pulse",
    theme_json: {
      mode: "dark",
      primaryColor: "#0B0B0F",
      accentColor: "#22D3EE",
      secondaryColor: "#A3E635",
      fontFamily: "Inter",
      borderRadius: "2xl",
      cardStyle: "glass",
      animationStyle: "smooth",
    },
    copy_json: {
      heroTitle: "Train smarter. Move further.",
      heroSubtitle: "Book a session with our certified coaches in seconds.",
      ctaText: "Book a Session",
      confirmationMessage: "Your session is locked in. See you on the floor.",
    },
    booking_rules_json: {
      allowStaffSelection: true,
      requirePhone: true,
      requireEmail: true,
      allowNotes: true,
      preventDoubleBooking: true,
      slotDurationMinutes: 60,
      maxAdvanceBookingDays: 30,
      cancellationWindowHours: 12,
      requirePayment: true,
      paymentMethods: ["visa", "apple_pay", "google_pay", "samsung_pay", "paypal", "knet"],
    },
    layout_json: { showTestimonials: true, showStaff: true, showServicesPreview: true },
  }),
  row({
    id: "cfg-lumen",
    business_id: "biz-lumen",
    theme_json: {
      mode: "light",
      primaryColor: "#FAF7F2",
      accentColor: "#C2410C",
      secondaryColor: "#1F2937",
      fontFamily: "Plus Jakarta Sans",
      borderRadius: "2xl",
      cardStyle: "soft",
      animationStyle: "smooth",
    },
    copy_json: {
      heroTitle: "Beauty, on your schedule.",
      heroSubtitle: "Premium cuts, color, and care from our master stylists.",
      ctaText: "Book Appointment",
      confirmationMessage: "You're booked. Can't wait to see you.",
    },
    booking_rules_json: {
      allowStaffSelection: true,
      requirePhone: true,
      requireEmail: true,
      allowNotes: true,
      preventDoubleBooking: true,
      slotDurationMinutes: 45,
      maxAdvanceBookingDays: 45,
      cancellationWindowHours: 24,
      requirePayment: true,
      paymentMethods: ["visa", "apple_pay", "google_pay", "paypal"],
    },
    layout_json: { showTestimonials: true, showStaff: true, showServicesPreview: true },
  }),
  row({
    id: "cfg-northgate",
    business_id: "biz-northgate",
    theme_json: {
      mode: "light",
      primaryColor: "#F8FAFC",
      accentColor: "#0EA5E9",
      secondaryColor: "#0F172A",
      fontFamily: "Inter",
      borderRadius: "xl",
      cardStyle: "flat",
      animationStyle: "subtle",
    },
    copy_json: {
      heroTitle: "Care without the wait.",
      heroSubtitle: "Same-week appointments with trusted clinicians.",
      ctaText: "Book a Visit",
      confirmationMessage: "Your visit is scheduled.",
    },
    booking_rules_json: {
      allowStaffSelection: true,
      requirePhone: true,
      requireEmail: true,
      allowNotes: true,
      preventDoubleBooking: true,
      slotDurationMinutes: 30,
      maxAdvanceBookingDays: 60,
      cancellationWindowHours: 24,
      // clinics often invoice rather than charge upfront
      requirePayment: false,
      paymentMethods: ["visa", "apple_pay", "google_pay"],
    },
    layout_json: { showTestimonials: false, showStaff: true, showServicesPreview: true },
  }),
  row({
    id: "cfg-stillpoint",
    business_id: "biz-stillpoint",
    theme_json: {
      mode: "light",
      primaryColor: "#FFFBEB",
      accentColor: "#7C3AED",
      secondaryColor: "#0F172A",
      fontFamily: "Plus Jakarta Sans",
      borderRadius: "2xl",
      cardStyle: "glass",
      animationStyle: "smooth",
    },
    copy_json: {
      heroTitle: "Find your stillness.",
      heroSubtitle: "Drop into a class led by experienced teachers.",
      ctaText: "Reserve Mat",
      confirmationMessage: "Your spot is reserved. Breathe.",
    },
    booking_rules_json: {
      allowStaffSelection: false,
      requirePhone: false,
      requireEmail: true,
      allowNotes: false,
      preventDoubleBooking: true,
      slotDurationMinutes: 75,
      maxAdvanceBookingDays: 21,
      cancellationWindowHours: 4,
      requirePayment: true,
      paymentMethods: ["visa", "apple_pay", "google_pay", "knet"],
    },
    layout_json: { showTestimonials: true, showStaff: true, showServicesPreview: true },
  }),
];

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

const svc = (extra: Partial<ServiceRow>): ServiceRow =>
  row({
    image_url: null,
    metadata_json: {},
    is_active: true,
    description: null,
    color: "#3B82F6",
    currency: "USD",
    ...extra,
  } as ServiceRow);

export const DEMO_SERVICES: ServiceRow[] = [
  svc({ id: "svc-pt", business_id: "biz-pulse", name: "Personal Training", description: "1:1 coached strength session.", duration_minutes: 60, price: 80, capacity: 1, color: "#22D3EE" }),
  svc({ id: "svc-open", business_id: "biz-pulse", name: "Open Gym", description: "Floor access with on-call coach.", duration_minutes: 60, price: 20, capacity: 12, color: "#A3E635" }),
  svc({ id: "svc-hiit", business_id: "biz-pulse", name: "HIIT Class", description: "Group conditioning circuit.", duration_minutes: 45, price: 25, capacity: 14, color: "#F472B6" }),
  svc({ id: "svc-cut", business_id: "biz-lumen", name: "Signature Cut", description: "Consultation, cut and finish.", duration_minutes: 45, price: 65, capacity: 1, color: "#C2410C" }),
  svc({ id: "svc-color", business_id: "biz-lumen", name: "Color & Highlights", description: "Custom color with toner.", duration_minutes: 120, price: 180, capacity: 1, color: "#A21CAF" }),
  svc({ id: "svc-blow", business_id: "biz-lumen", name: "Express Blowout", description: "Wash and style.", duration_minutes: 30, price: 40, capacity: 1, color: "#0EA5E9" }),
  svc({ id: "svc-consult", business_id: "biz-northgate", name: "General Consult", description: "Standard 30-min visit.", duration_minutes: 30, price: 90, capacity: 1, color: "#0EA5E9" }),
  svc({ id: "svc-physical", business_id: "biz-northgate", name: "Annual Physical", description: "Comprehensive wellness check.", duration_minutes: 60, price: 180, capacity: 1, color: "#10B981" }),
  svc({ id: "svc-vinyasa", business_id: "biz-stillpoint", name: "Vinyasa Flow", description: "Dynamic 75-min flow.", duration_minutes: 75, price: 22, capacity: 16, color: "#7C3AED" }),
  svc({ id: "svc-yin", business_id: "biz-stillpoint", name: "Yin & Restore", description: "Slow, grounded practice.", duration_minutes: 75, price: 22, capacity: 18, color: "#A78BFA" }),
];

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

const stf = (extra: Partial<StaffRow>): StaffRow =>
  row({
    profile_photo_url: null,
    metadata_json: {},
    is_active: true,
    bio: null,
    role: null,
    specialty: null,
    rating: 4.9,
    ...extra,
  } as StaffRow);

export const DEMO_STAFF: StaffRow[] = [
  stf({ id: "stf-maya",   business_id: "biz-pulse",      name: "Maya Okafor",       role: "Head Coach",          specialty: "Strength & conditioning", rating: 4.95, bio: "8 years coaching, NSCA-CPT." }),
  stf({ id: "stf-daniel", business_id: "biz-pulse",      name: "Daniel Reeves",     role: "Coach",               specialty: "Olympic lifting",         rating: 4.86, bio: "Former collegiate athlete." }),
  stf({ id: "stf-riley",  business_id: "biz-lumen",      name: "Riley Chen",        role: "Master Stylist",      specialty: "Precision cuts & color",  rating: 4.92, bio: "A decade in editorial styling." }),
  stf({ id: "stf-jordan", business_id: "biz-lumen",      name: "Jordan Hayes",      role: "Senior Stylist",      specialty: "Balayage",                rating: 4.78, bio: "Color specialist." }),
  stf({ id: "stf-aisha",  business_id: "biz-northgate",  name: "Dr. Aisha Rahman",  role: "Family Physician",    specialty: "Preventive care",         rating: 4.97, bio: "Board-certified, 12 years." }),
  stf({ id: "stf-marco",  business_id: "biz-northgate",  name: "Dr. Marco Vela",    role: "Internal Medicine",   specialty: "Cardio risk",             rating: 4.88, bio: "Specializes in long-term care." }),
  stf({ id: "stf-sana",   business_id: "biz-stillpoint", name: "Sana Patel",        role: "Lead Teacher",        specialty: "Vinyasa & breathwork",    rating: 4.99, bio: "E-RYT 500, 10+ years teaching." }),
  stf({ id: "stf-theo",   business_id: "biz-stillpoint", name: "Theo Brennan",      role: "Teacher",             specialty: "Yin & restorative",       rating: 4.84, bio: "Trauma-informed practice." }),
];

// ---------------------------------------------------------------------------
// Time-slot generator
// ---------------------------------------------------------------------------

/**
 * Generates ~14 days of upcoming slots for a business. Every (service, staff)
 * combination gets multiple open hours per day so customers always have real
 * choice. A small deterministic fraction is pre-booked to make the picker feel
 * alive.
 */
export function generateDemoSlots(businessId: string): TimeSlotRow[] {
  const services = DEMO_SERVICES.filter((s) => s.business_id === businessId);
  const staff = DEMO_STAFF.filter((s) => s.business_id === businessId);
  if (services.length === 0) return [];

  // Hours each (service, staff) pair runs at; staggered by service+staff index
  // so the day has activity throughout, not bunched up.
  const baseHours = [9, 11, 13, 15, 17];

  const out: TimeSlotRow[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let day = 0; day < 14; day++) {
    const dayStart = new Date(today);
    dayStart.setDate(dayStart.getDate() + day);

    services.forEach((service, sIdx) => {
      const staffPool = staff.length > 0 ? staff : [null as unknown as StaffRow];
      staffPool.forEach((staffMember, stIdx) => {
        // each pair runs at most 4 slots per day, shifted slightly per pair
        const offset = (sIdx + stIdx) % 2;
        const hours = baseHours.slice(offset).slice(0, 4);

        hours.forEach((hour) => {
          const start = new Date(dayStart);
          start.setHours(hour, 0, 0, 0);
          if (start.getTime() < Date.now()) return;

          const end = new Date(start);
          end.setMinutes(start.getMinutes() + service.duration_minutes);

          const seed = day * 137 + hour * 11 + sIdx * 7 + stIdx * 3;
          // ~1 in 8 slots starts pre-booked
          const preBooked = seed % 8 === 0 ? 1 : 0;
          const bookedCount = Math.min(preBooked, service.capacity);

          out.push(
            row({
              id: `slot-${businessId}-${day}-${hour}-${sIdx}-${stIdx}`,
              business_id: businessId,
              service_id: service.id,
              staff_id: staffMember ? staffMember.id : null,
              start_time: start.toISOString(),
              end_time: end.toISOString(),
              capacity: service.capacity,
              booked_count: bookedCount,
              status: bookedCount >= service.capacity ? "full" : "open",
            }) as TimeSlotRow,
          );
        });
      });
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function findDemoBusinessBySlug(slug: string) {
  const business = DEMO_BUSINESSES.find((b) => b.slug === slug);
  if (!business) return null;
  const config = DEMO_CONFIGS.find((c) => c.business_id === business.id) ?? null;
  return { business, config };
}

export function getDemoServices(businessId: string, onlyActive = true) {
  return DEMO_SERVICES.filter((s) => s.business_id === businessId && (!onlyActive || s.is_active));
}

export function getDemoStaff(businessId: string, onlyActive = true) {
  return DEMO_STAFF.filter((s) => s.business_id === businessId && (!onlyActive || s.is_active));
}
