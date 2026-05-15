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

  // booking flow
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
