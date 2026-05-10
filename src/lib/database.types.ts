// Hand-written Supabase Database types for Bookit.
// In a real project, regenerate via: supabase gen types typescript --project-id <id>

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ---------------------------------------------------------------------------
// Domain shapes for JSONB columns
// ---------------------------------------------------------------------------

export interface ThemeJson {
  mode: "light" | "dark";
  primaryColor: string;
  accentColor: string;
  secondaryColor: string;
  fontFamily: string;
  borderRadius: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  cardStyle: "glass" | "soft" | "flat" | "outline";
  animationStyle: "smooth" | "subtle" | "playful";
}

export interface CopyJson {
  heroTitle: string;
  heroSubtitle: string;
  ctaText: string;
  confirmationMessage: string;
  [key: string]: string | undefined;
}

export interface BookingRulesJson {
  allowStaffSelection: boolean;
  requirePhone: boolean;
  requireEmail: boolean;
  allowNotes: boolean;
  preventDoubleBooking: boolean;
  slotDurationMinutes: number;
  maxAdvanceBookingDays: number;
  cancellationWindowHours: number;
  /** Optional — when omitted, all built-in payment methods are enabled. */
  paymentMethods?: (
    | "visa"
    | "apple_pay"
    | "google_pay"
    | "samsung_pay"
    | "paypal"
    | "knet"
    | "mada"
    | "stcpay"
    | "uaecc"
    | "amex"
  )[];
  /** Optional — collect payment before confirming. Defaults to true. */
  requirePayment?: boolean;
}

export interface LayoutJson {
  showTestimonials?: boolean;
  showStaff?: boolean;
  showServicesPreview?: boolean;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

export interface BusinessRow {
  id: string;
  name: string;
  slug: string;
  industry: string;
  logo_url: string | null;
  owner_id: string | null;
  is_active: boolean;
  // Location (optional — older rows can have null)
  address: string | null;
  city: string | null;
  country: string | null;        // ISO 3166-1 alpha-2 (KW, SA, AE, …)
  postal_code: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website: string | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessConfigRow {
  id: string;
  business_id: string;
  theme_json: ThemeJson;
  copy_json: CopyJson;
  booking_rules_json: BookingRulesJson;
  layout_json: LayoutJson;
  created_at: string;
  updated_at: string;
}

export interface ServiceRow {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  currency: string;
  capacity: number;
  color: string | null;
  image_url: string | null;
  is_active: boolean;
  metadata_json: Json;
  created_at: string;
  updated_at: string;
}

export interface StaffRow {
  id: string;
  business_id: string;
  name: string;
  role: string | null;
  specialty: string | null;
  bio: string | null;
  profile_photo_url: string | null;
  rating: number | null;
  is_active: boolean;
  metadata_json: Json;
  created_at: string;
  updated_at: string;
}

export interface TimeSlotRow {
  id: string;
  business_id: string;
  service_id: string | null;
  staff_id: string | null;
  start_time: string;
  end_time: string;
  capacity: number;
  booked_count: number;
  status: "open" | "closed" | "full" | "cancelled";
  created_at: string;
  updated_at: string;
}

export interface BookingRow {
  id: string;
  business_id: string;
  service_id: string;
  staff_id: string | null;
  slot_id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  notes: string | null;
  booking_reference: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
  // Payment fields (all optional for backwards compatibility)
  payment_method: string | null;
  payment_status: "unpaid" | "pending" | "paid" | "refunded" | "failed" | null;
  payment_amount: number | null;
  payment_currency: string | null;
  payment_transaction_id: string | null;
  payment_provider_ref: string | null;
  // MyFatoorah / generic provider fields
  provider: string | null;
  provider_invoice_id: string | null;
  provider_payment_url: string | null;
  provider_initiated_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Insert / Update helpers
// All scalar columns are optional on Insert/Update because Postgres has
// defaults for ids and timestamps. This matches what `supabase gen types`
// produces.
// ---------------------------------------------------------------------------

type AllOptional<T> = { [K in keyof T]?: T[K] };

export type BusinessInsert = AllOptional<BusinessRow>;
export type BusinessUpdate = AllOptional<BusinessRow>;
export type BusinessConfigInsert = AllOptional<BusinessConfigRow>;
export type BusinessConfigUpdate = AllOptional<BusinessConfigRow>;
export type ServiceInsert = AllOptional<ServiceRow>;
export type ServiceUpdate = AllOptional<ServiceRow>;
export type StaffInsert = AllOptional<StaffRow>;
export type StaffUpdate = AllOptional<StaffRow>;
export type TimeSlotInsert = AllOptional<TimeSlotRow>;
export type TimeSlotUpdate = AllOptional<TimeSlotRow>;
export type BookingInsert = AllOptional<BookingRow>;
export type BookingUpdate = AllOptional<BookingRow>;

// ---------------------------------------------------------------------------
// Database interface (matches `supabase gen types typescript` output shape)
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: BusinessRow;
        Insert: BusinessInsert;
        Update: BusinessUpdate;
        Relationships: [];
      };
      business_configs: {
        Row: BusinessConfigRow;
        Insert: BusinessConfigInsert;
        Update: BusinessConfigUpdate;
        Relationships: [];
      };
      services: {
        Row: ServiceRow;
        Insert: ServiceInsert;
        Update: ServiceUpdate;
        Relationships: [];
      };
      staff: {
        Row: StaffRow;
        Insert: StaffInsert;
        Update: StaffUpdate;
        Relationships: [];
      };
      time_slots: {
        Row: TimeSlotRow;
        Insert: TimeSlotInsert;
        Update: TimeSlotUpdate;
        Relationships: [];
      };
      bookings: {
        Row: BookingRow;
        Insert: BookingInsert;
        Update: BookingUpdate;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_booking_atomic: {
        Args: {
          p_business_id: string;
          p_service_id: string;
          p_staff_id: string | null;
          p_slot_id: string;
          p_customer_name: string;
          p_customer_phone: string | null;
          p_customer_email: string | null;
          p_notes: string | null;
        };
        Returns: BookingRow;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
