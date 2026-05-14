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

const NULL_LOCATION = {
  address: null as string | null,
  city: null as string | null,
  country: null as string | null,
  postal_code: null as string | null,
  lat: null as number | null,
  lng: null as number | null,
  phone: null as string | null,
  website: null as string | null,
  timezone: null as string | null,
};

// Marketplace defaults applied to every demo business. 10% commission with
// payouts enabled — replace per-row to demonstrate different commission
// tiers across the demo dataset.
const DEFAULT_ESCROW = {
  connected_account_id: "demo_acct_marketplace" as string | null,
  commission_bps: 1000,                          // 10.00%
  payouts_enabled: true,
  iban_last4: "4321" as string | null,
  payout_provider: "myfatoorah" as string,
};

export const DEMO_BUSINESSES: BusinessRow[] = [
  row({
    id: "biz-pulse",
    name: "Pulse Athletic Club",
    slug: "pulse-athletic",
    industry: "gym",
    logo_url: null,
    owner_id: null,
    is_active: true,
    ...DEFAULT_ESCROW,
    ...NULL_LOCATION,
    address: "Block 4, Salem Al-Mubarak Street",
    city: "Salmiya",
    country: "KW",
    postal_code: "22001",
    lat: 29.336100,
    lng: 48.077800,
    phone: "+965 2222 3344",
    website: "https://pulseathletic.example",
    timezone: "Asia/Kuwait",
  }),
  row({
    id: "biz-lumen",
    name: "Lumen Hair Studio",
    slug: "lumen-hair",
    industry: "salon",
    logo_url: null,
    owner_id: null,
    is_active: true,
    ...DEFAULT_ESCROW,
    ...NULL_LOCATION,
    address: "Olympia Mall, Ground Floor",
    city: "Salmiya",
    country: "KW",
    postal_code: "22002",
    lat: 29.330200,
    lng: 48.084300,
    phone: "+965 2257 1100",
    timezone: "Asia/Kuwait",
  }),
  row({
    id: "biz-northgate",
    name: "Northgate Family Clinic",
    slug: "northgate-clinic",
    industry: "clinic",
    logo_url: null,
    owner_id: null,
    is_active: true,
    ...DEFAULT_ESCROW,
    ...NULL_LOCATION,
    address: "Beirut Street, Al-Bahr Tower, 3rd Floor",
    city: "Hawalli",
    country: "KW",
    postal_code: "30002",
    lat: 29.330700,
    lng: 48.030200,
    phone: "+965 2266 0044",
    timezone: "Asia/Kuwait",
  }),
  row({
    id: "biz-stillpoint",
    name: "Stillpoint Yoga",
    slug: "stillpoint-yoga",
    industry: "yoga",
    logo_url: null,
    owner_id: null,
    is_active: true,
    ...DEFAULT_ESCROW,
    ...NULL_LOCATION,
    address: "Block 6, Mishref Co-op Roundabout",
    city: "Mishref",
    country: "KW",
    postal_code: "40001",
    lat: 29.281200,
    lng: 48.094500,
    phone: "+965 2538 7700",
    timezone: "Asia/Kuwait",
  }),
  // ─── Sports facilities (GCC-flavoured) ────────────────────────────────────
  row({
    id: "biz-galaxy",
    name: "Galaxy Football Arena",
    slug: "galaxy-football",
    industry: "football",
    logo_url: null,
    owner_id: null,
    is_active: true,
    ...DEFAULT_ESCROW,
    ...NULL_LOCATION,
    address: "Block 11, Sport Club Street",
    city: "Salmiya",
    country: "KW",
    postal_code: "22033",
    lat: 29.341200,
    lng: 48.071400,
    phone: "+965 9000 1122",
    website: "https://galaxyfootball.example",
    timezone: "Asia/Kuwait",
  }),
  row({
    id: "biz-hoops",
    name: "Hoops Arena",
    slug: "hoops-arena",
    industry: "basketball",
    logo_url: null,
    owner_id: null,
    is_active: true,
    ...DEFAULT_ESCROW,
    ...NULL_LOCATION,
    address: "Tunis Street, Hawalli Sports Complex",
    city: "Hawalli",
    country: "KW",
    postal_code: "30021",
    lat: 29.328400,
    lng: 48.025700,
    phone: "+965 9000 5566",
    timezone: "Asia/Kuwait",
  }),
  row({
    id: "biz-padel",
    name: "Padel Point",
    slug: "padel-point",
    industry: "padel",
    logo_url: null,
    owner_id: null,
    is_active: true,
    ...DEFAULT_ESCROW,
    ...NULL_LOCATION,
    address: "King Fahd Road, Olaya District",
    city: "Riyadh",
    country: "SA",
    postal_code: "12333",
    lat: 24.700300,
    lng: 46.679200,
    phone: "+966 11 200 4477",
    website: "https://padelpoint.example",
    timezone: "Asia/Riyadh",
  }),
  row({
    id: "biz-boundary",
    name: "Boundary Cricket Hub",
    slug: "boundary-cricket",
    industry: "cricket",
    logo_url: null,
    owner_id: null,
    is_active: true,
    ...DEFAULT_ESCROW,
    ...NULL_LOCATION,
    address: "Sheikh Zayed Road, Al Quoz 2",
    city: "Dubai",
    country: "AE",
    postal_code: "00000",
    lat: 25.140100,
    lng: 55.225600,
    phone: "+971 4 388 9900",
    timezone: "Asia/Dubai",
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
    copy_json_ar: {
      heroTitle: "تمرين أذكى. تقدّم أبعد.",
      heroSubtitle: "احجز حصّتك مع مدرّبينا المعتمدين خلال ثوانٍ.",
      ctaText: "احجز حصّة",
      confirmationMessage: "تم تأكيد الحصّة. نلتقي على الأرضية.",
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

  // ─── Galaxy Football Arena (KW) ─────────────────────────────────────────
  row({
    id: "cfg-galaxy",
    business_id: "biz-galaxy",
    theme_json: {
      mode: "dark",
      primaryColor: "#0A1A0E",
      accentColor: "#22C55E",
      secondaryColor: "#FACC15",
      fontFamily: "Inter",
      borderRadius: "2xl",
      cardStyle: "glass",
      animationStyle: "playful",
    },
    copy_json: {
      heroTitle: "Game on. Pitch booked.",
      heroSubtitle: "Floodlit 5v5 and 7v7 turf in the heart of the city. Reserve in seconds.",
      ctaText: "Book Pitch",
      confirmationMessage: "Pitch reserved. Bring the boots — see you on the turf.",
    },
    copy_json_ar: {
      heroTitle: "الملعب جاهز. الحجز محسوم.",
      heroSubtitle: "ملاعب 5v5 و 7v7 معشّبة وبإضاءة كاملة في قلب المدينة. احجز خلال ثوانٍ.",
      ctaText: "احجز الملعب",
      confirmationMessage: "تم حجز الملعب. جهّز الجزمة — نلتقي على العشب.",
    },
    booking_rules_json: {
      allowStaffSelection: false,
      requirePhone: true,
      requireEmail: true,
      allowNotes: true,
      preventDoubleBooking: true,
      slotDurationMinutes: 60,
      maxAdvanceBookingDays: 30,
      cancellationWindowHours: 24,
      requirePayment: true,
      paymentMethods: ["knet", "visa", "apple_pay", "google_pay", "samsung_pay"],
    },
    layout_json: { showTestimonials: true, showStaff: true, showServicesPreview: true },
  }),

  // ─── Hoops Arena ────────────────────────────────────────────────────────
  row({
    id: "cfg-hoops",
    business_id: "biz-hoops",
    theme_json: {
      mode: "dark",
      primaryColor: "#0F0A05",
      accentColor: "#F97316",
      secondaryColor: "#FFFFFF",
      fontFamily: "Inter",
      borderRadius: "xl",
      cardStyle: "glass",
      animationStyle: "smooth",
    },
    copy_json: {
      heroTitle: "Run the floor.",
      heroSubtitle: "Indoor courts, hardwood feel, league-grade lighting. Hourly rentals and clinics.",
      ctaText: "Reserve Court",
      confirmationMessage: "Court is yours. Lace up.",
    },
    booking_rules_json: {
      allowStaffSelection: false,
      requirePhone: true,
      requireEmail: true,
      allowNotes: true,
      preventDoubleBooking: true,
      slotDurationMinutes: 60,
      maxAdvanceBookingDays: 21,
      cancellationWindowHours: 12,
      requirePayment: true,
      paymentMethods: ["knet", "visa", "apple_pay", "google_pay"],
    },
    layout_json: { showTestimonials: true, showStaff: true, showServicesPreview: true },
  }),

  // ─── Padel Point ────────────────────────────────────────────────────────
  row({
    id: "cfg-padel",
    business_id: "biz-padel",
    theme_json: {
      mode: "light",
      primaryColor: "#F1F8FF",
      accentColor: "#0284C7",
      secondaryColor: "#FACC15",
      fontFamily: "Plus Jakarta Sans",
      borderRadius: "2xl",
      cardStyle: "soft",
      animationStyle: "smooth",
    },
    copy_json: {
      heroTitle: "Padel, on demand.",
      heroSubtitle: "Glass-walled courts, regulation lights, 60-minute slots all day.",
      ctaText: "Book Court",
      confirmationMessage: "Court reserved. See you at the baseline.",
    },
    booking_rules_json: {
      allowStaffSelection: false,
      requirePhone: true,
      requireEmail: true,
      allowNotes: false,
      preventDoubleBooking: true,
      slotDurationMinutes: 60,
      maxAdvanceBookingDays: 14,
      cancellationWindowHours: 6,
      requirePayment: true,
      // Saudi Arabia: MADA + STC Pay are the local rails
      paymentMethods: ["mada", "stcpay", "visa", "apple_pay", "google_pay"],
    },
    layout_json: { showTestimonials: true, showStaff: true, showServicesPreview: true },
  }),

  // ─── Boundary Cricket Hub ───────────────────────────────────────────────
  row({
    id: "cfg-boundary",
    business_id: "biz-boundary",
    theme_json: {
      mode: "light",
      primaryColor: "#FFF8F0",
      accentColor: "#B91C1C",
      secondaryColor: "#0F172A",
      fontFamily: "Inter",
      borderRadius: "xl",
      cardStyle: "soft",
      animationStyle: "subtle",
    },
    copy_json: {
      heroTitle: "Bat. Bowl. Repeat.",
      heroSubtitle: "Indoor nets, turf wickets, and coached sessions for all levels.",
      ctaText: "Book Net",
      confirmationMessage: "You're in. Pads on, bring water.",
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
      // UAE: Visa/MC + UAE-Cards locally; Apple Pay & Google Pay supported
      paymentMethods: ["visa", "uaecc", "apple_pay", "google_pay"],
    },
    layout_json: { showTestimonials: false, showStaff: true, showServicesPreview: true },
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

  // ─── Galaxy Football Arena (KWD pricing) ───────────────────────────────
  svc({
    id: "svc-5v5",
    business_id: "biz-galaxy",
    name: "5-a-side Pitch (5v5)",
    description: "Full 5v5 turf pitch with floodlights, balls, bibs and goalposts. Whole pitch for one team.",
    duration_minutes: 60,
    price: 12,
    currency: "KWD",
    capacity: 1,
    color: "#22C55E",
  }),
  svc({
    id: "svc-7v7",
    business_id: "biz-galaxy",
    name: "7-a-side Pitch (7v7)",
    description: "Larger 7v7 turf with bigger goals. Ideal for full team practice or league games.",
    duration_minutes: 60,
    price: 18,
    currency: "KWD",
    capacity: 1,
    color: "#16A34A",
  }),
  svc({
    id: "svc-football-training",
    business_id: "biz-galaxy",
    name: "Group Football Training",
    description: "Coached 90-minute session: drills, tactics, small-sided games. Open enrolment.",
    duration_minutes: 90,
    price: 6,
    currency: "KWD",
    capacity: 16,
    color: "#FACC15",
  }),
  svc({
    id: "svc-football-private",
    business_id: "biz-galaxy",
    name: "Private 1:1 Coaching",
    description: "Tailored session with a UEFA-licensed coach. Video review available on request.",
    duration_minutes: 60,
    price: 25,
    currency: "KWD",
    capacity: 1,
    color: "#84CC16",
  }),

  // ─── Hoops Arena ───────────────────────────────────────────────────────
  svc({
    id: "svc-fullcourt",
    business_id: "biz-hoops",
    name: "Full Court Rental",
    description: "Indoor full court, hardwood floor, scoreboard, two regulation hoops.",
    duration_minutes: 60,
    price: 15,
    currency: "KWD",
    capacity: 1,
    color: "#F97316",
  }),
  svc({
    id: "svc-halfcourt",
    business_id: "biz-hoops",
    name: "Half Court Rental",
    description: "Half court for shootarounds, 3v3, or skill work.",
    duration_minutes: 60,
    price: 8,
    currency: "KWD",
    capacity: 1,
    color: "#FB923C",
  }),
  svc({
    id: "svc-hoops-clinic",
    business_id: "biz-hoops",
    name: "Skills Clinic",
    description: "Coached 90-minute clinic: shooting, ball-handling, defensive footwork.",
    duration_minutes: 90,
    price: 7,
    currency: "KWD",
    capacity: 12,
    color: "#FACC15",
  }),
  svc({
    id: "svc-hoops-private",
    business_id: "biz-hoops",
    name: "1-on-1 Coaching",
    description: "Private session with a former pro. Skills, conditioning, film review.",
    duration_minutes: 60,
    price: 20,
    currency: "KWD",
    capacity: 1,
    color: "#FFFFFF",
  }),

  // ─── Padel Point ───────────────────────────────────────────────────────
  svc({
    id: "svc-padel-court",
    business_id: "biz-padel",
    name: "Court Booking",
    description: "Glass-walled padel court, racquets and balls available on request.",
    duration_minutes: 60,
    price: 160,
    currency: "SAR",
    capacity: 1,
    color: "#0284C7",
  }),
  svc({
    id: "svc-padel-group",
    business_id: "biz-padel",
    name: "Group Lesson",
    description: "Coached session for up to 4 players. Beginners welcome.",
    duration_minutes: 60,
    price: 90,
    currency: "SAR",
    capacity: 4,
    color: "#0EA5E9",
  }),
  svc({
    id: "svc-padel-private",
    business_id: "biz-padel",
    name: "Private Lesson",
    description: "1:1 with a certified padel coach. Stroke work + match strategy.",
    duration_minutes: 60,
    price: 250,
    currency: "SAR",
    capacity: 1,
    color: "#FACC15",
  }),

  // ─── Boundary Cricket Hub (Dubai) ───────────────────────────────────────
  svc({
    id: "svc-cricket-net",
    business_id: "biz-boundary",
    name: "Net Practice",
    description: "Indoor net session — bowling machine optional. Bring your own bat or rent one.",
    duration_minutes: 60,
    price: 75,
    currency: "AED",
    capacity: 4,
    color: "#B91C1C",
  }),
  svc({
    id: "svc-cricket-indoor",
    business_id: "biz-boundary",
    name: "Indoor Match",
    description: "Soft-ball indoor match. Bring 6-8 players, we provide the rest.",
    duration_minutes: 60,
    price: 280,
    currency: "AED",
    capacity: 1,
    color: "#0F172A",
  }),
  svc({
    id: "svc-cricket-coach",
    business_id: "biz-boundary",
    name: "Coaching Session",
    description: "Batting or bowling tuition with an ECB-qualified coach.",
    duration_minutes: 60,
    price: 220,
    currency: "AED",
    capacity: 1,
    color: "#DC2626",
  }),
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

  // ─── Galaxy Football Arena ────────────────────────────────────────────
  stf({ id: "stf-yousef", business_id: "biz-galaxy",     name: "Coach Yousef Al-Anjari", role: "Head Coach",      specialty: "Tactics & finishing",     rating: 4.96, bio: "UEFA B-licensed. Former GCC league striker." }),
  stf({ id: "stf-ahmad",  business_id: "biz-galaxy",     name: "Coach Ahmad Saeed",      role: "Youth Coach",     specialty: "U16 development",         rating: 4.88, bio: "Youth development specialist, 8 years coaching." }),

  // ─── Hoops Arena ──────────────────────────────────────────────────────
  stf({ id: "stf-marcus", business_id: "biz-hoops",      name: "Marcus Johnson",         role: "Head Coach",      specialty: "Shooting mechanics",      rating: 4.97, bio: "Ex-pro guard. Skills development for all levels." }),
  stf({ id: "stf-laila",  business_id: "biz-hoops",      name: "Laila Hashem",           role: "Strength Coach",  specialty: "On-court conditioning",   rating: 4.83, bio: "CSCS, builds engines that finish games." }),

  // ─── Padel Point ──────────────────────────────────────────────────────
  stf({ id: "stf-rafa",   business_id: "biz-padel",      name: "Rafael Moreno",          role: "Head Pro",        specialty: "Bandeja, vibora, defence", rating: 4.94, bio: "PPA-certified, 12 years pro padel." }),
  stf({ id: "stf-mona",   business_id: "biz-padel",      name: "Mona Al-Sabah",          role: "Coach",           specialty: "Beginner foundations",     rating: 4.79, bio: "Builds students from racquet-up." }),

  // ─── Boundary Cricket Hub ─────────────────────────────────────────────
  stf({ id: "stf-vikram", business_id: "biz-boundary",   name: "Coach Vikram Iyer",      role: "Batting Coach",   specialty: "Top-order technique",      rating: 4.95, bio: "ECB Level 3. Mentored 3 first-class debutants." }),
  stf({ id: "stf-imran",  business_id: "biz-boundary",   name: "Coach Imran Qureshi",    role: "Bowling Coach",   specialty: "Pace & swing",             rating: 4.91, bio: "Former U19 fast bowler, full-spectrum mentor." }),
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
