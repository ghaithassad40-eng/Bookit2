import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Send, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSubmitReview, useReviewForBooking } from "@/hooks/useReviews";
import { useI18n } from "@/hooks/useI18n";
import { useRegion } from "@/hooks/useRegion";
import { initials, cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  businessId: string;
  bookingReference: string;
  customerName: string;
}

/**
 * Single-shot rating + comment form for the post-booking Confirmation page.
 * One review per booking_reference — once submitted, the form swaps to a
 * read-only "Thanks for your review" state.
 */
export function ReviewForm({ businessId, bookingReference, customerName }: Props) {
  const { t } = useI18n();
  const { country } = useRegion();
  const { data: existing, isLoading } = useReviewForBooking(bookingReference);
  const submit = useSubmitReview();

  const [hoverRating, setHoverRating] = useState(0);
  const [rating, setRating] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);
  const [comment, setComment] = useState("");

  if (isLoading) return null;

  // Already left a review for this booking → show read-only state.
  if (existing) {
    return (
      <Card className="overflow-hidden border-emerald-500/20">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            {t("review.thanks")}
          </div>
          <div className="flex gap-0.5 text-amber-400">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn("h-4 w-4", i < existing.rating ? "fill-current" : "opacity-25")}
              />
            ))}
          </div>
          {existing.comment && (
            <p className="text-sm leading-relaxed text-foreground/85">"{existing.comment}"</p>
          )}
          <p className="text-[11px] text-muted-foreground">
            {t("review.publishedAs")} {existing.customer_name}
          </p>
        </CardContent>
      </Card>
    );
  }

  const displayRating = hoverRating || rating;

  async function handleSubmit() {
    if (rating === 0) {
      toast.error(t("review.ratingRequired"));
      return;
    }
    try {
      await submit.mutateAsync({
        business_id: businessId,
        booking_reference: bookingReference,
        rating: rating as 1 | 2 | 3 | 4 | 5,
        comment: comment.trim() ? comment.trim() : null,
        customer_name: customerName,
        customer_initials: initials(customerName),
        customer_country: country && country !== "ALL" ? country : null,
      });
      toast.success(t("review.posted"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("review.failed"));
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-5">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t("review.title")}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t("review.subtitle")}</p>
        </div>

        {/* Star picker */}
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setHoverRating(n)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(n as 1 | 2 | 3 | 4 | 5)}
              className="grid h-9 w-9 place-items-center rounded-lg transition-transform hover:scale-110"
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
            >
              <motion.span
                animate={{ scale: rating === n ? 1.05 : 1 }}
                className="grid place-items-center"
              >
                <Star
                  className={cn(
                    "h-6 w-6 transition-colors",
                    n <= displayRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
                  )}
                />
              </motion.span>
            </button>
          ))}
          {displayRating > 0 && (
            <span className="ms-2 text-xs font-medium text-muted-foreground">
              {t(`review.rating${displayRating}` as
                | "review.rating1"
                | "review.rating2"
                | "review.rating3"
                | "review.rating4"
                | "review.rating5")}
            </span>
          )}
        </div>

        {/* Comment textarea */}
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder={t("review.commentPlaceholder")}
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        />

        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] text-muted-foreground">
            {comment.length}/500
          </span>
          <Button onClick={handleSubmit} disabled={submit.isPending || rating === 0} size="sm">
            {submit.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("review.posting")}
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                {t("review.submit")}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
