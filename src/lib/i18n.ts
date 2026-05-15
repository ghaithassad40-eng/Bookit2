// Minimal i18n with explicit translation maps.
//
// We deliberately avoid pulling in react-i18next (35-40 kB). The surface area
// is small enough that a flat key->string map per locale + a React Context
// covers everything customer-facing.
//
// To add a third language: extend `Locale`, add a map under STRINGS, and the
// rest of the code picks it up automatically.

export type Locale = "en" | "ar";

export interface LocaleMeta {
  code: Locale;
  label: string;
  nativeLabel: string;
  flag: string;
  dir: "ltr" | "rtl";
  /** BCP-47 base used for Intl formatters. Country code is appended at runtime. */
  intlBase: string;
}

export const LOCALES: Record<Locale, LocaleMeta> = {
  en: { code: "en", label: "English", nativeLabel: "English", flag: "🇬🇧", dir: "ltr", intlBase: "en" },
  ar: { code: "ar", label: "Arabic",  nativeLabel: "العربية", flag: "🇰🇼", dir: "rtl", intlBase: "ar" },
};

// ---------------------------------------------------------------------------
// Translation keys (flat, dot-namespaced)
// ---------------------------------------------------------------------------

// Every key declared here must have an entry in STRINGS.en and STRINGS.ar.
// TypeScript enforces it via the `Strings` type below.

const STRINGS_EN = {
  // navigation / global
  "nav.book": "Book",
  "nav.signIn": "Sign in",
  "nav.listYourBusiness": "List your business",
  "nav.backTo": "Back to",
  "nav.bookAnother": "Book another",
  "common.loading": "Loading…",
  "common.back": "Back",
  "common.cancel": "Cancel",
  "common.continue": "Continue",
  "common.save": "Save",
  "common.tryAgain": "Try again",
  "common.contactSupport": "Contact support",
  "common.findUs": "Find us",
  "common.findUsDescription": "Tap the map for turn-by-turn directions in your favourite app.",

  // home
  "home.taglineBadge": "Now taking bookings — set up in minutes",
  "home.headline": "Bookings, beautifully on autopilot.",
  "home.subhead": "The modern way to take appointments — for gyms, salons, clinics, studios and more. Your brand, your hours, your team. Customers book in seconds.",
  "home.askConcierge": "Ask the concierge",
  "home.browseAll": "Browse all places",
  "home.nav.features": "Features",
  "home.nav.liveDemos": "Live demos",
  "home.nav.reviews": "Reviews",
  "home.nav.community": "Community",
  "home.nav.howItWorks": "How it works",
  "home.nav.listBusiness": "List your business",
  "home.stats.industries": "industries",
  "home.stats.toBook": "to book",
  "home.stats.alwaysOpen": "always open",
  "home.concierge.badge": "Find your place in seconds",
  "home.concierge.heading": "Not sure where to book? Ask.",
  "home.concierge.body": "Describe what you need in your own words. The concierge will surface places that match.",
  "home.places.eyebrow": "Browse places",
  "home.places.heading": "Pick a place, book in seconds.",
  "home.places.openBookingPage": "Open booking page",
  "home.places.empty.title": "Demos coming online soon",
  "home.places.empty.body": "Live demo workspaces will appear here. Check back shortly.",
  "home.features.eyebrow": "Why teams switch",
  "home.features.heading": "Everything your front desk does — without the front desk.",
  "home.features.neverDoubleBook.title": "Never double-book",
  "home.features.neverDoubleBook.body": "Slots lock the moment a customer reserves. No overlaps, no awkward calls, no embarrassment.",
  "home.features.brand.title": "Match your brand",
  "home.features.brand.body": "Choose colors, fonts and copy until the booking page feels like yours — not a third-party form.",
  "home.features.mobile.title": "Built for phones",
  "home.features.mobile.body": "Customers book in under a minute on mobile. Big tap targets, no zooming, no friction.",
  "home.how.eyebrow": "How it works",
  "home.how.heading": "From signup to booked in three steps.",
  "home.how.step1.title": "Create your page",
  "home.how.step1.body": "Sign up and get your own branded booking link to share.",
  "home.how.step2.title": "Add services & team",
  "home.how.step2.body": "Set your offerings, prices and hours — change them anytime.",
  "home.how.step3.title": "Get booked",
  "home.how.step3.body": "Customers tap, pick a time, and you're confirmed instantly.",
  "home.listing.eyebrow": "For business owners",
  "home.listing.title": "List your business",
  "home.listing.body": "Set up your own booking page in minutes.",
  "home.listing.cta": "Get started",
  "home.footer.copyright": "Bookit",
  "home.footer.tagline": "Built for service businesses everywhere",
  // industry chip labels
  "industry.gym": "Gym",
  "industry.salon": "Salon",
  "industry.clinic": "Clinic",
  "industry.yoga": "Yoga",
  "industry.spa": "Spa",
  "industry.football": "Football",
  "industry.basketball": "Basketball",
  "industry.padel": "Padel",
  "industry.cricket": "Cricket",

  // booking flow
  // booking stepper labels
  "step.service": "Service",
  "step.staff": "Staff",
  "step.slot": "Slot",
  "step.details": "Details",
  "step.review": "Review",
  "step.payment": "Pay",

  "book.chooseService": "Choose a service",
  "book.chooseStaff": "Choose your specialist",
  "book.noPreference": "No preference",
  "book.pickTime": "Pick a time",
  "book.yourDetails": "Your details",
  "book.reviewYourBooking": "Review your booking",
  "book.continueToPayment": "Continue to payment",
  "book.confirmBooking": "Confirm booking",
  "book.summary": "Summary",
  "book.service": "Service",
  "book.specialist": "Specialist",
  "book.when": "When",
  "book.total": "Total",

  // booking form fields
  "form.fullName": "Full name",
  "form.email": "Email",
  "form.phone": "Phone",
  "form.notes": "Notes (optional)",
  "form.nameRequired": "Name is required",
  "form.emailRequired": "Valid email required",
  "form.phoneRequired": "Valid phone required",
  "form.continue": "Continue",
  "form.reviewing": "Reviewing…",

  // payment
  "payment.title": "Payment",
  "payment.subtitle": "Choose how you'd like to pay. All transactions are encrypted.",
  "payment.method": "Payment method",
  "payment.pay": "Pay",
  "payment.redirectingTo": "Redirecting to",
  "payment.confirmed": "Payment confirmed",
  "payment.verifying": "Verifying payment…",
  "payment.verifyingDescription": "We're confirming the transaction with the gateway. This usually takes a few seconds.",
  "payment.bookingConfirmed": "Booking confirmed",
  "payment.paid": "Paid",
  "payment.pending": "Pending",
  "payment.unpaid": "Unpaid",
  "payment.regionInfoTitle": "Payment methods by region",
  "payment.regionInfoSubtitle": "Tap to see what's accepted in each country and how Apple/Google Pay route locally.",
  "payment.yourRegion": "Your region",
  "payment.subtotal": "Subtotal",
  "payment.serviceCharge": "Service charge",
  "payment.tax": "Tax",
  "payment.totalPaid": "Total paid",
  "payment.securePayment": "Secure payment",
  "payment.cardNumber": "Card number",
  "payment.expiry": "Expiry",
  "payment.cvc": "CVC",
  "payment.cardholderName": "Cardholder name",
  "payment.cardholderPlaceholder": "Name as printed on card",
  "payment.cardNumberPlaceholder": "1234 5678 9012 3456",
  "payment.expiryPlaceholder": "MM/YY",
  "payment.cvcPlaceholder": "123",
  "payment.cardNumberError": "Enter a valid card number",
  "payment.expiryError": "Format MM/YY",
  "payment.cvcError": "3 or 4 digits",
  "payment.cardholderError": "Cardholder name required",
  "payment.payAmount": "Pay",
  "payment.youllBeCharged": "You'll be charged",
  "payment.inMerchantCurrency": "in the merchant's currency.",
  "payment.confirmBiometrics": "Confirm with biometrics on device",
  "payment.reference": "Reference",
  "payment.redirect": "Redirect",
  "payment.paypalBody": "You'll be taken to PayPal to log in and confirm the payment, then returned here.",
  "payment.knetBody": "You'll be taken to your Knet bank portal to authorise the payment, then returned here.",
  "payment.rowAmount": "Amount",
  "payment.rowChargedMerchantCurrency": "Charged in merchant currency",
  "payment.rowMerchantReference": "Merchant reference",
  "payment.continueTo": "Continue to",

  // failure page
  "fail.title": "Payment failed",
  "fail.headline": "We couldn't process your payment.",
  "fail.reassurance": "Don't worry — you haven't been charged. Your booking slot is still available, so try again with a different method or come back to it later.",
  "fail.commonCauses": "Common causes",
  "fail.cardDeclined": "Card declined",
  "fail.cardDeclinedBody": "Your bank rejected the charge — usually insufficient funds or a security block.",
  "fail.authFailed": "Authentication failed",
  "fail.authFailedBody": "OTP or 3-D Secure didn't go through in time. Try again with the code.",
  "fail.connectionLost": "Connection lost",
  "fail.connectionLostBody": "The session expired or the network dropped. Restart the booking.",
  "fail.helpHint": "Need help? Reach out with your reference and we'll get the booking sorted manually.",
  "fail.bookingUnconfirmed": "Booking unconfirmed",
  "fail.attemptReference": "Attempt reference",

  // invoice
  "invoice.bookingConfirmed": "Booking confirmed",
  "invoice.invoice": "INVOICE",
  "invoice.bookingReference": "Booking reference",
  "invoice.bookingDetails": "Booking details",
  "invoice.billedTo": "Billed to",
  "invoice.charges": "Charges",
  "invoice.payment": "Payment",
  "invoice.print": "Print invoice",
  "invoice.saveTheDate": "Save the date",
  "invoice.saveTheDateBody": "Add this to your calendar so you don't miss it.",
  "invoice.issued": "Issued",
  "invoice.duration": "Duration",
  "invoice.minutes": "minutes",

  // language picker
  "lang.language": "Language",
  "lang.switchTo": "Switch to",

  // booking cancel + refund
  "booking.cancel": "Cancel booking",
  "booking.cancelConfirmTitle": "Cancel this booking?",
  "booking.cancelConfirmBody":
    "Your slot will be released. If you've paid, we'll refund the full amount to your original payment method — it can take 3–7 business days to land back in your account.",
  "booking.cancelKeep": "Keep booking",
  "booking.cancelConfirm": "Yes, cancel & refund",
  "booking.cancelling": "Cancelling…",
  "booking.cancelled": "Booking cancelled",
  "booking.cancelledBody":
    "Your slot has been released. Your reference is still valid for your records.",
  "booking.refundIssued": "Refund issued",
  "booking.refundIssuedBody":
    "We've sent the refund to your original payment method. Expect it in 3–7 business days.",
  "booking.cancelFailed": "Could not cancel the booking",

  // post-booking review form
  "review.title": "Leave a review",
  "review.subtitle": "How was your experience? Your feedback helps other customers.",
  "review.commentPlaceholder": "Tell us what stood out (optional)…",
  "review.submit": "Post review",
  "review.posting": "Posting…",
  "review.posted": "Thanks — your review is live",
  "review.thanks": "Thanks for your review",
  "review.publishedAs": "Posted as",
  "review.ratingRequired": "Pick a star rating first",
  "review.failed": "Couldn't post the review — try again in a moment",
  "review.rating1": "Poor",
  "review.rating2": "Fair",
  "review.rating3": "Good",
  "review.rating4": "Great",
  "review.rating5": "Excellent",
  "review.noComment": "★ rated — no comment left.",

  // landing page sections
  "landing.services": "Services",
  "landing.servicesSubtitle": "Pick one and book in under a minute.",
  "landing.seeAll": "See all",
  "landing.meetTheTeam": "Meet the team",
  "landing.meetTheTeamSubtitle": "Trusted experts ready to help.",
  "landing.whatGuestsSay": "What guests say",
  "landing.readyToBook": "Ready to book?",
  "landing.readyToBookSubtitle": "Pick a time that works for you.",
  "landing.exploreServices": "Explore services",

  // service card chips
  "service.minutes": "min",
  "service.upTo": "up to",

  // welcome / region picker
  "welcome.title": "Welcome to Bookit",
  "welcome.subtitle": "Pick your country and language. We'll show you businesses near you and translate the site to match.",
  "welcome.country": "Country",
  "welcome.language": "Language",
  "welcome.continue": "Continue",
  "welcome.allCountries": "Show all countries",
  "welcome.skip": "Skip",
  "welcome.changeLater": "You can change this anytime from the header.",
  "region.changeRegion": "Change region",
  "region.in": "in",
  "region.noBusinessesYet": "No businesses in this country yet",
  "region.noBusinessesBody": "We're expanding fast. Pick another country or check back soon.",
  "region.tryDifferentCountry": "Try another country",
} as const;

type Strings = typeof STRINGS_EN;
export type TranslationKey = keyof Strings;

const STRINGS_AR: Record<TranslationKey, string> = {
  "nav.book": "احجز",
  "nav.signIn": "تسجيل الدخول",
  "nav.listYourBusiness": "أضِف نشاطك",
  "nav.backTo": "العودة إلى",
  "nav.bookAnother": "احجز موعداً آخر",
  "common.loading": "جارٍ التحميل…",
  "common.back": "رجوع",
  "common.cancel": "إلغاء",
  "common.continue": "متابعة",
  "common.save": "حفظ",
  "common.tryAgain": "حاول مرة أخرى",
  "common.contactSupport": "التواصل مع الدعم",
  "common.findUs": "موقعنا",
  "common.findUsDescription": "اضغط على الخريطة للحصول على الاتجاهات في تطبيقك المفضّل.",

  "home.taglineBadge": "نستقبل الحجوزات الآن — جاهز خلال دقائق",
  "home.headline": "حجوزات مرتّبة، تعمل تلقائياً.",
  "home.subhead": "الطريقة الحديثة لاستقبال الحجوزات — للنوادي الرياضية والصالونات والعيادات والاستوديوهات وأكثر. علامتك التجارية، ساعاتك، وفريقك. عملاؤك يحجزون خلال ثوانٍ.",
  "home.askConcierge": "اسأل المساعد الذكي",
  "home.browseAll": "تصفّح كل الأماكن",
  "home.nav.features": "المزايا",
  "home.nav.liveDemos": "تجارب مباشرة",
  "home.nav.reviews": "التقييمات",
  "home.nav.community": "المجتمع",
  "home.nav.howItWorks": "كيف يعمل",
  "home.nav.listBusiness": "أضِف نشاطك",
  "home.stats.industries": "قطاع",
  "home.stats.toBook": "للحجز",
  "home.stats.alwaysOpen": "متاح دائماً",
  "home.concierge.badge": "اعثر على مكانك خلال ثوانٍ",
  "home.concierge.heading": "لست متأكّداً أين تحجز؟ اسأل.",
  "home.concierge.body": "اكتب ما تحتاجه بكلماتك، وسيعرض لك المساعد الأماكن المناسبة.",
  "home.places.eyebrow": "تصفّح الأماكن",
  "home.places.heading": "اختر مكاناً واحجز خلال ثوانٍ.",
  "home.places.openBookingPage": "افتح صفحة الحجز",
  "home.places.empty.title": "التجارب المباشرة قادمة قريباً",
  "home.places.empty.body": "ستظهر هنا قريباً تجارب مباشرة. تابعنا.",
  "home.features.eyebrow": "لماذا يتحوّلون لبكيت",
  "home.features.heading": "كل ما يفعله موظف الاستقبال — من دون موظف استقبال.",
  "home.features.neverDoubleBook.title": "لا تكرار للحجوزات",
  "home.features.neverDoubleBook.body": "تُقفل المواعيد لحظة الحجز. لا تعارض، لا اتصالات محرجة، لا إحراج.",
  "home.features.brand.title": "علامتك التجارية أولاً",
  "home.features.brand.body": "اختر الألوان والخطوط والنصوص حتى تصبح صفحة الحجز جزءاً من علامتك — لا نموذجاً غريباً.",
  "home.features.mobile.title": "مصمَّم للجوال",
  "home.features.mobile.body": "يحجز عملاؤك من الجوال خلال أقل من دقيقة. أزرار كبيرة، بدون تكبير ولا احتكاك.",
  "home.how.eyebrow": "كيف يعمل",
  "home.how.heading": "من التسجيل إلى الحجز في ثلاث خطوات.",
  "home.how.step1.title": "أنشئ صفحتك",
  "home.how.step1.body": "سجّل واحصل على رابط حجز مخصّص لك للمشاركة.",
  "home.how.step2.title": "أضِف الخدمات والفريق",
  "home.how.step2.body": "حدّد عروضك وأسعارك وساعاتك — وعدّلها متى شئت.",
  "home.how.step3.title": "ابدأ تستقبل الحجوزات",
  "home.how.step3.body": "العميل يضغط، يختار الوقت، ويصلك التأكيد فوراً.",
  "home.listing.eyebrow": "لأصحاب الأنشطة",
  "home.listing.title": "أضِف نشاطك",
  "home.listing.body": "أنشئ صفحة الحجز الخاصّة بك خلال دقائق.",
  "home.listing.cta": "ابدأ الآن",
  "home.footer.copyright": "بكيت",
  "home.footer.tagline": "صُمِّم لأصحاب الأنشطة الخدميّة في كل مكان",
  "industry.gym": "نادي رياضي",
  "industry.salon": "صالون",
  "industry.clinic": "عيادة",
  "industry.yoga": "يوغا",
  "industry.spa": "سبا",
  "industry.football": "كرة قدم",
  "industry.basketball": "كرة سلة",
  "industry.padel": "بادل",
  "industry.cricket": "كريكت",

  "step.service": "الخدمة",
  "step.staff": "المختصّ",
  "step.slot": "الوقت",
  "step.details": "بياناتك",
  "step.review": "المراجعة",
  "step.payment": "الدفع",

  "book.chooseService": "اختر الخدمة",
  "book.chooseStaff": "اختر المختصّ",
  "book.noPreference": "بدون تفضيل",
  "book.pickTime": "اختر الوقت",
  "book.yourDetails": "بياناتك",
  "book.reviewYourBooking": "مراجعة الحجز",
  "book.continueToPayment": "المتابعة إلى الدفع",
  "book.confirmBooking": "تأكيد الحجز",
  "book.summary": "الملخّص",
  "book.service": "الخدمة",
  "book.specialist": "المختصّ",
  "book.when": "الموعد",
  "book.total": "المجموع",

  "form.fullName": "الاسم الكامل",
  "form.email": "البريد الإلكتروني",
  "form.phone": "رقم الهاتف",
  "form.notes": "ملاحظات (اختياري)",
  "form.nameRequired": "الاسم مطلوب",
  "form.emailRequired": "بريد إلكتروني صالح مطلوب",
  "form.phoneRequired": "رقم هاتف صالح مطلوب",
  "form.continue": "متابعة",
  "form.reviewing": "جارٍ المراجعة…",

  "payment.title": "الدفع",
  "payment.subtitle": "اختر طريقة الدفع. جميع المعاملات مشفّرة.",
  "payment.method": "طريقة الدفع",
  "payment.pay": "ادفع",
  "payment.redirectingTo": "جارٍ التحويل إلى",
  "payment.confirmed": "تم تأكيد الدفع",
  "payment.verifying": "جارٍ التحقّق من الدفع…",
  "payment.verifyingDescription": "نتأكّد من المعاملة لدى مزوّد الدفع. عادةً تستغرق العملية ثوانٍ.",
  "payment.bookingConfirmed": "تم تأكيد الحجز",
  "payment.paid": "مدفوع",
  "payment.pending": "قيد الانتظار",
  "payment.unpaid": "غير مدفوع",
  "payment.regionInfoTitle": "طرق الدفع حسب البلد",
  "payment.regionInfoSubtitle": "اطّلع على الطرق المقبولة في كل بلد وكيفية توجيه Apple/Google Pay محلياً.",
  "payment.yourRegion": "بلدك",
  "payment.subtotal": "المجموع الفرعي",
  "payment.serviceCharge": "رسوم الخدمة",
  "payment.tax": "الضريبة",
  "payment.totalPaid": "إجمالي المدفوع",
  "payment.securePayment": "دفع آمن",
  "payment.cardNumber": "رقم البطاقة",
  "payment.expiry": "تاريخ الانتهاء",
  "payment.cvc": "CVC",
  "payment.cardholderName": "اسم حامل البطاقة",
  "payment.cardholderPlaceholder": "الاسم كما هو مكتوب على البطاقة",
  "payment.cardNumberPlaceholder": "1234 5678 9012 3456",
  "payment.expiryPlaceholder": "MM/YY",
  "payment.cvcPlaceholder": "123",
  "payment.cardNumberError": "أدخل رقم بطاقة صالح",
  "payment.expiryError": "الصيغة MM/YY",
  "payment.cvcError": "3 أو 4 أرقام",
  "payment.cardholderError": "اسم حامل البطاقة مطلوب",
  "payment.payAmount": "ادفع",
  "payment.youllBeCharged": "سيتمّ خصم",
  "payment.inMerchantCurrency": "بعملة المتجر.",
  "payment.confirmBiometrics": "أكِّد ببصمتك من الجهاز",
  "payment.reference": "الرقم المرجعي",
  "payment.redirect": "تحويل",
  "payment.paypalBody": "ستُنقل إلى PayPal لتسجيل الدخول وتأكيد الدفع، ثمّ ستعود إلى هنا.",
  "payment.knetBody": "ستُنقل إلى بوّابة بنك Knet للموافقة على الدفع، ثمّ ستعود إلى هنا.",
  "payment.rowAmount": "المبلغ",
  "payment.rowChargedMerchantCurrency": "المبلغ بعملة المتجر",
  "payment.rowMerchantReference": "الرقم المرجعي",
  "payment.continueTo": "المتابعة إلى",

  "fail.title": "فشل الدفع",
  "fail.headline": "لم نتمكّن من إتمام عملية الدفع.",
  "fail.reassurance": "لا تقلق — لم يتمّ خصم أي مبلغ. موعد الحجز ما زال متاحاً، يمكنك المحاولة مرة أخرى بطريقة دفع مختلفة.",
  "fail.commonCauses": "الأسباب الشائعة",
  "fail.cardDeclined": "تم رفض البطاقة",
  "fail.cardDeclinedBody": "رفض البنك العملية — عادةً بسبب رصيد غير كافٍ أو حظر أمني.",
  "fail.authFailed": "فشل التحقّق",
  "fail.authFailedBody": "لم يتمّ إدخال رمز OTP أو 3-D Secure في الوقت المناسب. أعد المحاولة بالرمز.",
  "fail.connectionLost": "انقطاع الاتصال",
  "fail.connectionLostBody": "انتهت الجلسة أو تعطّلت الشبكة. ابدأ الحجز من جديد.",
  "fail.helpHint": "تحتاج مساعدة؟ تواصل معنا بالرقم المرجعي وسنُكمل الحجز يدوياً.",
  "fail.bookingUnconfirmed": "حجز غير مؤكّد",
  "fail.attemptReference": "الرقم المرجعي للمحاولة",

  "invoice.bookingConfirmed": "تم تأكيد الحجز",
  "invoice.invoice": "فاتورة",
  "invoice.bookingReference": "رقم الحجز",
  "invoice.bookingDetails": "تفاصيل الحجز",
  "invoice.billedTo": "صادرة إلى",
  "invoice.charges": "الرسوم",
  "invoice.payment": "الدفع",
  "invoice.print": "طباعة الفاتورة",
  "invoice.saveTheDate": "احفظ التاريخ",
  "invoice.saveTheDateBody": "أضِف الحجز إلى تقويمك حتى لا تنساه.",
  "invoice.issued": "صدرت في",
  "invoice.duration": "المدة",
  "invoice.minutes": "دقيقة",

  "lang.language": "اللغة",
  "lang.switchTo": "التبديل إلى",

  "booking.cancel": "إلغاء الحجز",
  "booking.cancelConfirmTitle": "هل تريد إلغاء هذا الحجز؟",
  "booking.cancelConfirmBody":
    "سيتم تحرير موعدك. إذا كنت قد دفعت، سنُعيد المبلغ كاملاً إلى طريقة الدفع الأصلية — قد يستغرق ذلك من ٣ إلى ٧ أيام عمل ليصل إلى حسابك.",
  "booking.cancelKeep": "الإبقاء على الحجز",
  "booking.cancelConfirm": "نعم، ألغِ واسترد المبلغ",
  "booking.cancelling": "جارٍ الإلغاء…",
  "booking.cancelled": "تم إلغاء الحجز",
  "booking.cancelledBody":
    "تم تحرير موعدك. الرقم المرجعي ما زال صالحاً لسجلاتك.",
  "booking.refundIssued": "تم استرداد المبلغ",
  "booking.refundIssuedBody":
    "أرسلنا المبلغ إلى طريقة الدفع الأصلية. توقّع وصوله خلال ٣ إلى ٧ أيام عمل.",
  "booking.cancelFailed": "تعذّر إلغاء الحجز",

  "review.title": "اترك تقييمك",
  "review.subtitle": "كيف كانت تجربتك؟ ملاحظاتك تساعد العملاء الآخرين.",
  "review.commentPlaceholder": "أخبرنا بما أعجبك (اختياري)…",
  "review.submit": "نشر التقييم",
  "review.posting": "جارٍ النشر…",
  "review.posted": "شكراً — تم نشر تقييمك",
  "review.thanks": "شكراً على تقييمك",
  "review.publishedAs": "نُشر باسم",
  "review.ratingRequired": "اختر التقييم بالنجوم أولاً",
  "review.failed": "تعذّر نشر التقييم — حاول مرة أخرى بعد قليل",
  "review.rating1": "ضعيف",
  "review.rating2": "مقبول",
  "review.rating3": "جيد",
  "review.rating4": "ممتاز",
  "review.rating5": "رائع",
  "review.noComment": "★ تقييم بدون تعليق.",

  "landing.services": "الخدمات",
  "landing.servicesSubtitle": "اختر واحدة واحجز خلال أقل من دقيقة.",
  "landing.seeAll": "عرض الكل",
  "landing.meetTheTeam": "تعرّف على الفريق",
  "landing.meetTheTeamSubtitle": "خبراء جاهزون لمساعدتك.",
  "landing.whatGuestsSay": "ماذا يقول الضيوف",
  "landing.readyToBook": "جاهز للحجز؟",
  "landing.readyToBookSubtitle": "اختر الوقت الذي يناسبك.",
  "landing.exploreServices": "تصفّح الخدمات",

  "service.minutes": "دقيقة",
  "service.upTo": "حتى",

  "welcome.title": "أهلاً بك في بكيت",
  "welcome.subtitle": "اختر بلدك ولغتك، وسنعرض لك الأماكن القريبة منك ونترجم الموقع بما يناسبك.",
  "welcome.country": "البلد",
  "welcome.language": "اللغة",
  "welcome.continue": "متابعة",
  "welcome.allCountries": "عرض كل البلدان",
  "welcome.skip": "تخطّي",
  "welcome.changeLater": "يمكنك تغيير الاختيار في أي وقت من رأس الصفحة.",
  "region.changeRegion": "تغيير المنطقة",
  "region.in": "في",
  "region.noBusinessesYet": "لا توجد أنشطة في هذا البلد بعد",
  "region.noBusinessesBody": "نحن نتوسّع بسرعة. جرّب بلداً آخر أو عُد قريباً.",
  "region.tryDifferentCountry": "جرّب بلداً آخر",
};

const STRINGS: Record<Locale, Strings> = {
  en: STRINGS_EN,
  ar: STRINGS_AR as Strings,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const STORAGE_KEY = "bookit.locale";

export function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (stored === "en" || stored === "ar") return stored;
  // Default: detect from browser
  const lang = window.navigator.language ?? "en";
  if (lang.startsWith("ar")) return "ar";
  return "en";
}

export function setStoredLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, locale);
}

export function translate(locale: Locale, key: TranslationKey, fallback?: string): string {
  return STRINGS[locale]?.[key] ?? fallback ?? key;
}

/** Build a BCP-47 tag from locale + country (e.g. "ar-KW", "en-KW"). */
export function intlLocale(locale: Locale, country?: string | null): string {
  const base = LOCALES[locale].intlBase;
  if (!country) return base;
  return `${base}-${country.toUpperCase()}`;
}

/**
 * Resolve a localised copy_json — for Arabic, prefer the keys present in
 * `copy_json_ar` and fall back per-key to the English copy_json. This means
 * a business can ship partial Arabic translations safely (e.g. only the
 * hero), and untranslated keys still render in English.
 */
export function localizedCopy<T extends Record<string, unknown>>(
  locale: Locale,
  base: T,
  ar: Partial<T> | null | undefined,
): T {
  if (locale === "ar" && ar) {
    return { ...base, ...ar } as T;
  }
  return base;
}

/**
 * Pick the locale-appropriate value for a translatable field. Returns the
 * Arabic value when locale is "ar" AND the Arabic value is non-empty;
 * otherwise the English value. Use for free-form per-row content like
 * service name + description, staff role, etc.
 */
export function pickLocale<T>(locale: Locale, en: T, ar: T | null | undefined): T {
  if (locale === "ar" && ar !== null && ar !== undefined && ar !== "") return ar;
  return en;
}
