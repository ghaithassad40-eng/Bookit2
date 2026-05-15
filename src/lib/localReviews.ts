// Local persistence for customer reviews in demo mode.
//
// Production wiring should write to a `reviews` table via Supabase
// (id, business_id, booking_id, rating, comment, customer_name, created_at,
//  optional comment_ar for bilingual reviews). For now the entire pipeline is
// localStorage so the customer can leave + see + cancel their feedback
// without any backend.

export interface ReviewRow {
  id: string;
  business_id: string;
  /** booking reference used as a stable per-booking key — prevents duplicate
   * reviews from the same booking. */
  booking_reference: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string | null;
  /** Optional Arabic translation. Falls back to `comment`. */
  comment_ar?: string | null;
  customer_name: string;
  customer_initials: string;
  /** ISO 3166-1 alpha-2 of the customer's selected region — useful to render
   * a flag next to the review even though the business owner doesn't know
   * the customer's exact city. */
  customer_country: string | null;
  created_at: string;
}

const KEY = "bookit.demo.reviews";

export function getLocalReviews(): ReviewRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ReviewRow[];
  } catch {
    return [];
  }
}

export function getReviewsForBusiness(businessId: string): ReviewRow[] {
  return getLocalReviews()
    .filter((r) => r.business_id === businessId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function getReviewForBooking(bookingReference: string): ReviewRow | null {
  return getLocalReviews().find((r) => r.booking_reference === bookingReference) ?? null;
}

export function saveLocalReview(review: ReviewRow): ReviewRow {
  if (typeof window === "undefined") return review;
  const list = getLocalReviews();
  // de-duplicate per booking_reference — one review per booking
  const filtered = list.filter((r) => r.booking_reference !== review.booking_reference);
  filtered.push(review);
  window.localStorage.setItem(KEY, JSON.stringify(filtered));
  return review;
}

export function generateReviewId(): string {
  return `rev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Compute aggregate stats for a business: count + average rating. Useful for
 *  the Landing page hero badge and admin overview. */
export function reviewStatsForBusiness(businessId: string): {
  count: number;
  average: number;
} {
  const list = getReviewsForBusiness(businessId);
  if (list.length === 0) return { count: 0, average: 0 };
  const sum = list.reduce((acc, r) => acc + r.rating, 0);
  return { count: list.length, average: sum / list.length };
}
