---
name: Employee Bugs Solver
description: Systematically works through the Bookit bug backlog from the two QA tours (English + Arabic) in priority order. Each task ships its own focused commit with a typecheck. Use when the user says "fix the bugs", "work through the punch list", or invokes /employee-bugs-solver.
---

# Employee Bugs Solver — Bookit punch list

You are the on-call engineer for Bookit. Two QA tours (one English, one Arabic / RTL) surfaced ~40 issues across booking, refund, feedback, payments, i18n and demo data. Your job is to clear them in priority order.

## Operating rules

1. **One bug per commit.** Each fix is small, reviewable, and reverts cleanly. Commit message format: `Fix <area>: <one-line summary>` with a paragraph explaining the root cause and a `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` line.
2. **Typecheck before every commit.** Run `npx tsc --noEmit` and require exit 0.
3. **Verify in preview.** The Vite dev server is registered as `Vite dev server` on port 5173. Re-test the actual user flow you fixed — don't just trust the typecheck.
4. **Don't bundle.** If a single task spans multiple files, that's fine — but don't sneak unrelated changes into the same commit.
5. **Surface trade-offs.** When a fix needs data-model changes (e.g. adding `name_ar` to `StaffRow`), state the schema impact in the commit body so backend reviewers see it.
6. **Stop and ask** before doing anything destructive: deleting demo data, force-pushing, or changing the database schema in a way that breaks Supabase migrations.
7. **Update the user after each P0 and P1 fix** — a one-line "shipped X, on to Y" so they can intervene.

## Bug backlog (priority order)

### 🔴 P0 — Critical (blocker tasks the user explicitly asked about)

**P0-1. Add Cancel + Refund flow (customer side)**
- *Where:* `src/pages/customer/Confirmation.tsx` (currently only displays a static escrow banner with no action), `src/hooks/useBookings.ts` (no cancel mutation exists).
- *What:* Add a "Cancel booking & refund" button on the Confirmation page. Open an `AlertDialog` (shadcn) asking for confirmation. On confirm:
  - In demo mode → flip the booking in localStorage to `status: "cancelled"`, `payment_status: "refunded"`, `payout_status: "refunded"`.
  - In Supabase mode → call a `cancel_booking_atomic` RPC (write the migration too) that returns the same fields.
  - For MyFatoorah-charged bookings, hit `refundMyFatoorah(invoiceId, amount)` (add to `src/lib/myfatoorah.ts` — the staging API is `POST /v2/MakeRefund`).
- *Acceptance:* Customer can self-cancel a booking they just made and see the "Booking cancelled — refund issued" state with the original reference still visible.
- *Bilingual:* Add EN+AR keys `booking.cancel`, `booking.cancelConfirmTitle`, `booking.cancelConfirmBody`, `booking.cancelled`, `booking.refundIssued`.

**P0-2. Add Cancel + Refund flow (admin side)**
- *Where:* `src/pages/admin/Bookings.tsx` — currently has `cancelled` only as a status filter.
- *What:* Row-level action menu with "Cancel & refund" that hits the same mutation as P0-1.
- *Acceptance:* Business owner can cancel a customer's booking from the admin dashboard; refund triggers; ledger entry written.

**P0-3. Add Review/Feedback submission**
- *Where:* `src/pages/customer/Confirmation.tsx` (post-booking entry point) — currently has no feedback affordance.
- *What:*
  - Add a 5-star rating input + optional comment textarea below the invoice.
  - Persist to `reviews` table (new schema: `id, business_id, booking_id, rating, comment, comment_ar, customer_name, created_at`). Add migration.
  - In demo mode, persist to `localStorage["bookit.reviews"]`.
  - On submit, show a "Thanks — your review is live" state with the testimonial preview.
- *Acceptance:* Customer can rate 1-5 stars + write a comment; the review appears on the business landing page's testimonials block (replacing the hardcoded demo testimonials when real ones exist).
- *Bilingual:* All labels via `t()`.

**P0-4. Fix Padel Point demo data (KW business showing Saudi data)**
- *Where:* `src/lib/demoData.ts` — Padel Point currently has `country: "SA"`, address in Riyadh, phone +966, lat/lng 24.7003/46.6792, services priced in SAR.
- *What:* Update to:
  - `country: "KW"`, `city: "Kuwait City"`, `address: <real KW street>`, phone `+965 XX XXX XXX`, lat/lng for a Kuwait City landmark (~29.3759, 47.9774).
  - Service prices in `KWD` (drop the SAR figures; if they were intended as ~50 KWD = ~5 KWD slot, recompute).
- *Acceptance:* Padel Point appears in the Kuwait country filter; the booking page shows KWD natively (no SAR conversion); confirmation shows Kuwait map + flag.
- *Knock-on fix:* this also resolves the concierge "padel → basketball" misroute for Kuwait users.

**P0-5. Audit every demo business for country/currency consistency**
- *Where:* `src/lib/demoData.ts`.
- *What:* For each of the 8 businesses, confirm `country` matches the address, lat/lng, phone country code, and that all `services[].currency` matches the business country's default. Fix any drift.
- *Acceptance:* Click each business while country=KW, then SA, then AE — only co-country businesses appear, and prices never need a conversion blurb for same-country pairs.

### 🟠 P1 — Major flow / i18n gaps

**P1-1. Translate the Home page end to end**
- *Where:* `src/pages/Home.tsx`, `src/components/customer/SocialProof.tsx`.
- *What:* Every literal string in these two files needs `t()`. Add corresponding keys to both `STRINGS_EN` and `STRINGS_AR` in `src/lib/i18n.ts`. Affected strings include the nav (Features / Live demos / Reviews / Community / How it works / List your business), hero badge + headline + subhead + two CTAs, stats labels (INDUSTRIES / TO BOOK / ALWAYS OPEN), concierge section heading + subhead, Browse Places heading + chip industries + "Open booking page", every Feature card, every How-it-works step, the entire FOR BUSINESS OWNERS card, footer line.
- *Acceptance:* Loading `/` with locale=ar shows 100% Arabic copy. No literal English string remaining outside intentional brand marks ("Bookit", payment brand names, "Vibe music" if kept).

**P1-2. Translate the booking flow stepper labels**
- *Where:* `src/components/customer/BookingStepper.tsx` — currently uses literal English "Service", "Slot", "Details", "Review", "Pay".
- *What:* Replace with `t("step.service")`, etc. Add keys in EN+AR (`الخدمة`, `الوقت`, `بياناتك`, `المراجعة`, `الدفع`).
- *Acceptance:* Switching to Arabic shows Arabic step labels.

**P1-3. Translate the Wallet payment subcomponent**
- *Where:* `src/components/customer/PaymentForm.tsx` — the `WalletMethod` component is fully English.
- *What:* Wrap "One tap with Touch ID or Face ID.", "Confirm with biometrics on device", "Reference {ref}", "Pay {amount}", "You'll be charged {amount}." with `t()`. Same treatment for `CardForm`, `RedirectMethod`, and the page-level "Pending selection" / "Selected" badges.
- *Acceptance:* Arabic payment page is fully Arabic.

**P1-4. Translate the Confirmation / Invoice page**
- *Where:* `src/pages/customer/Confirmation.tsx`.
- *What:* All labels — "Booking confirmed" badge, "We've emailed a copy of this invoice to you.", "INVOICE", "Issued {date}", "Booking reference", "BOOKING DETAILS", "Service", "Save the date", "Add this to your calendar so you don't miss it.", "Print invoice", "Get directions", "Back to {business}", "Book another". Plus the `ShieldCheck` escrow banner.
- *Acceptance:* Arabic confirmation page is fully Arabic; service name uses `pickLocale(locale, service.name, service.name_ar)` instead of `service.name`.

**P1-5. Fix concierge intent matching for sports**
- *Where:* `src/lib/concierge.ts`.
- *What:*
  - Remove the bare Arabic word `"ملعب"` from the `football` keyword list — it's a generic word for "court/field" and currently misroutes every Arabic sport query to football.
  - Add explicit phrase matches: `"ملعب بادل"` → padel, `"ملعب سلة"` → basketball, `"ملعب كرة قدم"` → football, `"ملعب كريكت"` → cricket. Add an early-phase phrase scanner before the token-level intent loop.
  - Localize the response message — `REPLIES.oneMatch` currently embeds the intent string ("football", "padel") directly into the Arabic sentence. Replace with the localized industry label from a new `INDUSTRY_LABELS: Record<string, { en: string; ar: string }>` map.
- *Acceptance:* `أريد ملعب بادل الليلة` returns Padel Point (after P0-4 fixes its country). `كرة سلة` returns Hoops Arena.

**P1-6. Fix payment-method selection to follow customer region, not business country**
- *Where:* `src/lib/payments.ts` — `availableMethodsForBusiness()` or wherever the method list is built (search for `paymentMethods` filtering).
- *What:* The selector should union `business_country_methods` and `customer_country_methods` and prioritize the customer's local network at the top. For a Kuwait customer on a Saudi business, the list should still show KNET (because KNET will tokenize the customer's card) — even if the business settles in SAR.
- *Acceptance:* As a Kuwait customer on any business, KNET appears as a payment option.

**P1-7. Fix invoice missing service name + total**
- *Where:* `src/pages/customer/Confirmation.tsx`.
- *What:* The "Service" row renders as `—` because the page reads from `booking.service_id` but doesn't join the service. Look up the service via `useService(booking.service_id)` (or `useServices(business.id)` and find by id) and render the name. Render `payment_amount` + `payment_currency` in the charges block.
- *Acceptance:* Invoice shows e.g. `Court Booking — KWD 13.10`.

### 🟡 P2 — Polish (visible but not blocking)

**P2-1. Fix Padel Point hero title contrast**
- *Where:* `src/components/customer/Hero.tsx` — `bg-gradient-to-b from-foreground/95 to-foreground/50 bg-clip-text text-transparent` renders nearly invisible against light-theme card bg.
- *What:* Either drop the gradient on light mode (`dark:bg-gradient-to-b ... light:text-foreground`) or set a darker minimum stop (`from-foreground to-foreground/80`).
- *Acceptance:* "Padel, on demand." / "بادل، عند الطلب." is readable on both themes.

**P2-2. Localize day-of-week + time formatting in the slot picker**
- *Where:* `src/components/customer/SlotPicker.tsx` (or wherever `FRI 15` chips are generated).
- *What:* Use `new Intl.DateTimeFormat(intl(country), { weekday: "short" })` from the `useI18n().intl()` helper. Same for the day-section heading "Fri 15 May".
- *Acceptance:* Arabic users see `الجمعة ١٥`, `السبت ١٦`.

**P2-3. Localize slot count labels**
- *Where:* same component.
- *What:* "1 left" → `t("slot.left", { count })`. Plural-aware. Add EN + AR keys.

**P2-4. Localize ServiceCard chip numbers (mixed digits issue)**
- *Where:* `src/components/customer/ServiceCard.tsx`.
- *What:* The duration chip renders `{service.duration_minutes} {t("service.minutes")}` — the number stays Western. Pass through `intl()`'s number formatter for Arabic.
- *Acceptance:* `٦٠ دقيقة` and `حتى ٤`.

**P2-5. Hide duplicate slot times**
- *Where:* `src/components/customer/SlotPicker.tsx` (or the data layer in `useSlots`).
- *What:* When two slots have the same start time and one is fully booked (`booked_count >= capacity`), hide the fully-booked one in favor of the open one. If both are open, keep both (they're separate inventory).

**P2-6. Add `_ar` translations to staff data**
- *Where:* `src/lib/database.types.ts` — extend `StaffRow` with `name_ar`, `role_ar`, `specialty_ar`, `bio_ar`. Update `src/lib/demoData.ts` accordingly. Update `src/components/customer/StaffCard.tsx` to use `pickLocale()`.
- *Acceptance:* Arabic users see Arabic staff names / roles.

**P2-7. Add `name_ar` to business data**
- *Where:* `BusinessRow` → add `name_ar`. Wire `pickLocale` through `Hero.tsx`, the header in `CustomerLayout`, the `RegionPill` business reference, etc.

**P2-8. Fix activity ticker locale rotation in SocialProof**
- *Where:* `src/components/customer/SocialProof.tsx` — the ticker captures `ar = locale === "ar"` at component-render time but the rotation setInterval doesn't re-pick the locale. The fix is just to read `locale` inside the render of each ticker item (which it does) but ensure the rotation effect triggers a re-render — it already does via `setActivity`. Investigate why English items still appear and fix.
- *Acceptance:* All rotating items render in the active locale at all times.

**P2-9. Translate testimonial reviewer metadata**
- *Where:* `src/components/customer/SocialProof.tsx` — `REVIEWS` array has `name`, `city`, `industry` as plain strings. Add `nameAr`, `cityAr`, `industryAr` per reviewer, switch via locale.

**P2-10. Fix pay-button accessibility (icon read as text)**
- *Where:* `src/components/customer/PaymentForm.tsx` `SubmitButton`/`WalletMethod` — the `<PaymentBrandMark>` SVG renders text content that reads as "Pay" in the accessibility tree, making the button "Pay Pay KWD 13.10".
- *What:* Add `aria-hidden="true"` to the brand mark wrapper.

**P2-11. Welcome modal dismiss → don't auto-set country to "ALL"**
- *Where:* `src/components/customer/WelcomePicker.tsx` `dismiss()`.
- *What:* Accidentally clicking the backdrop today stores `country = "ALL"`, trapping the user out of regional filtering. Suggest: on dismiss, pre-fill from `detectCountry()` instead of `ALL`, and don't persist so the next visit prompts again.

### 🔵 P3 — Cleanup / dev infra

**P3-1. MyFatoorah mock ↔ verifier alignment**
- *Where:* `src/lib/myfatoorah.ts`, `src/pages/customer/MyFatoorahMock.tsx`, `src/pages/customer/PaymentCallback.tsx`.
- *What:* In dev with `VITE_MYFATOORAH_ENABLED=true`, the mock page completes a payment and writes a localStorage flag, but the callback verifier hits the real staging API which doesn't know about the mock invoice. Short-circuit `verifyMyFatoorahCallback` when the `paymentId` starts with `MFTEST-` to the localStorage path instead of the live API.
- *Acceptance:* A complete mock-payment flow ends on the confirmation page, never the failed page.

**P3-2. MyFatoorah mock respects the selected payment method**
- *Where:* `src/pages/customer/MyFatoorahMock.tsx`.
- *What:* If `method=apple_pay`, show the wallet biometric prompt instead of the card form. Same for `knet`, `mada`, `stcpay`, `google_pay`.

**P3-3. Add a /privacy and /terms link in footer** (good-to-have, not blocker).

---

## How to run

When invoked, walk the list top to bottom:

1. Read the next task you haven't checked off.
2. Open the relevant file(s), implement the fix.
3. Run `npx tsc --noEmit`. If it fails, fix and re-run.
4. Use the `Vite dev server` preview to validate the user-visible behavior (re-test the exact flow from the tour report).
5. Commit with the convention above, then push.
6. Tell the user "shipped P0-1 (cancel/refund customer side) → commit `abc1234`, on to P0-2".
7. Loop.

If a task turns out to be much bigger than its description (e.g. P0-3 requires a Supabase migration the user hasn't approved), pause and surface the choice via `AskUserQuestion` before proceeding.

If the user pings with a hotfix in the middle of a run, finish the current commit, then handle the hotfix, then resume.

## Out of scope

- Don't introduce new features beyond what's listed.
- Don't refactor `concierge.ts` into an LLM call — keep the local matcher.
- Don't change the demo-mode escrow flow's business logic — only the missing UI surfaces are P0.
