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

/**
 * Marketplace approval state. New vendor signups start as `pending` and are
 * invisible to customers until a platform admin approves the business.
 *   pending    — admin hasn't reviewed yet; hidden from public surfaces
 *   approved   — live and bookable
 *   suspended  — taken down by platform (fraud, policy, etc.); hidden
 *   rejected   — admin rejected at signup; hidden + reason shown to vendor
 */
export type BusinessStatus = "pending" | "approved" | "suspended" | "rejected";

export interface BusinessRow {
  id: string;
  name: string;
  /** Optional Arabic translation of name. Falls back to name when absent. */
  name_ar?: string | null;
  slug: string;
  industry: string;
  logo_url: string | null;
  owner_id: string | null;
  is_active: boolean;
  /** Marketplace approval state. Optional for back-compat — rows without
   *  this column are treated as `approved` so existing prod data isn't
   *  silently hidden. New rows must set it. */
  status?: BusinessStatus;
  /** Free-form admin note shown to the vendor when status is `rejected`. */
  rejection_reason?: string | null;
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
  // Marketplace + commission config (optional — null until onboarding done)
  connected_account_id: string | null;
  commission_bps: number;        // 1000 = 10.00%
  payouts_enabled: boolean;
  iban_last4: string | null;
  payout_provider: string;       // 'myfatoorah', 'stripe', etc.
  created_at: string;
  updated_at: string;
}

export interface BusinessConfigRow {
  id: string;
  business_id: string;
  theme_json: ThemeJson;
  copy_json: CopyJson;
  /** Optional Arabic translation of copy_json. Falls back to copy_json. */
  copy_json_ar?: Partial<CopyJson> | null;
  booking_rules_json: BookingRulesJson;
  layout_json: LayoutJson;
  created_at: string;
  updated_at: string;
}

export interface ServiceRow {
  id: string;
  business_id: string;
  name: string;
  /** Optional Arabic translation of name. Falls back to name when absent. */
  name_ar?: string | null;
  description: string | null;
  /** Optional Arabic translation of description. Falls back to description. */
  description_ar?: string | null;
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
  /** Optional Arabic translation of name. Falls back to name when absent. */
  name_ar?: string | null;
  role: string | null;
  /** Optional Arabic translation of role. Falls back to role. */
  role_ar?: string | null;
  specialty: string | null;
  /** Optional Arabic translation of specialty. Falls back to specialty. */
  specialty_ar?: string | null;
  bio: string | null;
  /** Optional Arabic translation of bio. Falls back to bio. */
  bio_ar?: string | null;
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

/**
 * Equipment / add-on items vendors can offer alongside their services.
 * Pattern: vendor maintains a per-business shelf (e.g. a co-working space
 * lists "Printer", "External Monitor", "Whiteboard markers"); customers
 * tick the items they want during booking, with a quantity. Items can be
 * free (`price === null`) or paid (`price > 0`); paid items add to the
 * booking total.
 *
 * The `features` array carries machine-friendly tags ("4k", "wireless",
 * "27-inch", "color-printing") so the AI equipment search can match user
 * queries like "find me a vendor with a 4K monitor".
 */
export interface EquipmentRow {
  id: string;
  business_id: string;
  name: string;
  /** Optional Arabic translation of name. Falls back to name when absent. */
  name_ar?: string | null;
  description: string | null;
  description_ar?: string | null;
  /** Vendor-defined grouping (e.g. "office", "av", "stationery"). Free-form. */
  category: string;
  /** Item price per unit. `null` means included free; render as "Included". */
  price: number | null;
  currency: string;
  image_url: string | null;
  /** Lowercase keyword tags used by the AI equipment search. */
  features: string[];
  /** Max quantity a single booking can request. Defaults to 1 client-side. */
  max_per_booking: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Per-booking line item — which equipment was selected, how many, at
 *  which unit price (snapshotted so vendor price changes don't retroactively
 *  affect issued receipts). */
export interface BookingEquipmentRow {
  id: string;
  booking_id: string;
  equipment_id: string;
  quantity: number;
  unit_price: number; // 0 when the source row's price is null
  currency: string;
  created_at: string;
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
  // Escrow / payout lifecycle (held → releasing → completed)
  payout_status: "held" | "releasing" | "completed" | "transfer_failed" | "refunded" | null;
  payout_id: string | null;
  released_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Escrow / payouts
// ---------------------------------------------------------------------------

export type PayoutStatus =
  | "pending_transfer"
  | "transferred"
  | "transfer_failed"
  | "reversed";

export type PayoutReason =
  | "service_completed"
  | "auto_release"
  | "manual_override"
  | "cancellation_window_expired";

export interface PayoutRow {
  id: string;
  idempotency_key: string;
  booking_id: string;
  business_id: string;
  gross_amount: number;
  psp_fee: number;
  platform_fee: number;
  merchant_amount: number;
  currency: string;
  status: PayoutStatus;
  reason: PayoutReason;
  actor: string;
  provider_transfer_id: string | null;
  provider: string;
  last_error: string | null;
  released_at: string;
  transferred_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LedgerEntryRow {
  id: string;
  account: string;
  amount: number;                                // signed: + credit, − debit
  currency: string;
  kind: "platform_fee" | "merchant_payout" | "reversal";
  booking_id: string | null;
  payout_id: string | null;
  business_id: string | null;
  created_at: string;
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
export type EquipmentInsert = AllOptional<EquipmentRow>;
export type EquipmentUpdate = AllOptional<EquipmentRow>;
export type BookingEquipmentInsert = AllOptional<BookingEquipmentRow>;
export type BookingEquipmentUpdate = AllOptional<BookingEquipmentRow>;

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
      equipment: {
        Row: EquipmentRow;
        Insert: EquipmentInsert;
        Update: EquipmentUpdate;
        Relationships: [];
      };
      booking_equipment: {
        Row: BookingEquipmentRow;
        Insert: BookingEquipmentInsert;
        Update: BookingEquipmentUpdate;
        Relationships: [];
      };
      payouts: {
        Row: PayoutRow;
        Insert: Partial<PayoutRow>;
        Update: Partial<PayoutRow>;
        Relationships: [];
      };
      ledger_entries: {
        Row: LedgerEntryRow;
        Insert: Partial<LedgerEntryRow>;
        Update: Partial<LedgerEntryRow>;
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
