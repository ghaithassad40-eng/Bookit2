import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  generateReviewId,
  getReviewForBooking,
  getReviewsForBusiness,
  reviewStatsForBusiness,
  saveLocalReview,
  type ReviewRow,
} from "@/lib/localReviews";

// Production target: a `reviews` Supabase table + an `insert_review_rpc` that
// validates the (booking_id, rating, comment) tuple against the booking row.
// Until that migration ships, every path here hits localStorage so the UI is
// runnable in demo mode without a backend.

export interface SubmitReviewInput {
  business_id: string;
  booking_reference: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string | null;
  customer_name: string;
  customer_initials: string;
  customer_country: string | null;
}

export function useSubmitReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SubmitReviewInput): Promise<ReviewRow> => {
      const row: ReviewRow = {
        id: generateReviewId(),
        business_id: input.business_id,
        booking_reference: input.booking_reference,
        rating: input.rating,
        comment: input.comment,
        comment_ar: null,
        customer_name: input.customer_name,
        customer_initials: input.customer_initials,
        customer_country: input.customer_country,
        created_at: new Date().toISOString(),
      };
      return saveLocalReview(row);
    },
    onSuccess: (review) => {
      qc.invalidateQueries({ queryKey: ["reviews", review.business_id] });
      qc.invalidateQueries({ queryKey: ["review-stats", review.business_id] });
      qc.invalidateQueries({ queryKey: ["review-for-booking", review.booking_reference] });
    },
  });
}

export function useReviewForBooking(bookingReference: string | null | undefined) {
  return useQuery({
    queryKey: ["review-for-booking", bookingReference ?? "none"],
    queryFn: () => (bookingReference ? getReviewForBooking(bookingReference) : null),
    enabled: !!bookingReference,
    staleTime: 5_000,
  });
}

export function useBusinessReviews(businessId: string | null | undefined) {
  return useQuery({
    queryKey: ["reviews", businessId ?? "none"],
    queryFn: () => (businessId ? getReviewsForBusiness(businessId) : []),
    enabled: !!businessId,
    staleTime: 10_000,
  });
}

export function useReviewStats(businessId: string | null | undefined) {
  return useQuery({
    queryKey: ["review-stats", businessId ?? "none"],
    queryFn: () =>
      businessId ? reviewStatsForBusiness(businessId) : { count: 0, average: 0 },
    enabled: !!businessId,
    staleTime: 10_000,
  });
}
