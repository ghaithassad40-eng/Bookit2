import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Heart,
  MessageCircle,
  Quote,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { Flag, type FlagCode } from "./Flag";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface Review {
  name: string;
  nameAr: string;
  initials: string;
  city: string;
  cityAr: string;
  country: FlagCode;
  industry: string;
  industryAr: string;
  rating: 5;
  quote: string;
  quoteAr: string;
}

const REVIEWS: Review[] = [
  {
    name: "Reem A.",
    nameAr: "ريم ع.",
    initials: "RA",
    city: "Riyadh",
    cityAr: "الرياض",
    country: "SA",
    industry: "Salon",
    industryAr: "صالون",
    rating: 5,
    quote:
      "I booked my colour appointment in two taps. The WhatsApp reminder came the day before — felt like a five-star hotel.",
    quoteAr:
      "حجزت موعد الصبغة بضغطتين. وصلتني رسالة تذكير على واتساب اليوم اللي قبل — حسّيت إني في فندق خمس نجوم.",
  },
  {
    name: "Mohammed Q.",
    nameAr: "محمد ق.",
    initials: "MQ",
    city: "Kuwait City",
    cityAr: "مدينة الكويت",
    country: "KW",
    industry: "Padel",
    industryAr: "بادل",
    rating: 5,
    quote:
      "Picking the slot instead of calling? Game changer. I can see who's booked which court at a glance.",
    quoteAr:
      "اختيار الوقت بدل ما أتصل؟ شي يفرق. أشوف الملاعب المحجوزة بنظرة واحدة.",
  },
  {
    name: "Layla K.",
    nameAr: "ليلى ك.",
    initials: "LK",
    city: "Dubai",
    cityAr: "دبي",
    country: "AE",
    industry: "Yoga",
    industryAr: "يوغا",
    rating: 5,
    quote:
      "I've tried five booking apps. This one just gets out of the way. I open, tap, and I'm done.",
    quoteAr:
      "جرّبت خمس تطبيقات حجز. هذا التطبيق ما يوقفك — تفتحه، تضغط، وخلصت.",
  },
  {
    name: "Khalid M.",
    nameAr: "خالد م.",
    initials: "KM",
    city: "Doha",
    cityAr: "الدوحة",
    country: "QA",
    industry: "Gym Owner",
    industryAr: "صاحب نادي",
    rating: 5,
    quote:
      "We moved our 6-coach gym to Bookit. No-shows dropped from 18% to 6% in the first month.",
    quoteAr:
      "حوّلنا الجيم اللي فيه 6 مدربين على بكيت. الغياب نزل من 18٪ إلى 6٪ في أول شهر.",
  },
  {
    name: "Noura H.",
    nameAr: "نورة ح.",
    initials: "NH",
    city: "Manama",
    cityAr: "المنامة",
    country: "BH",
    industry: "Clinic",
    industryAr: "عيادة",
    rating: 5,
    quote:
      "The Arabic feels native, not translated. My mother used it without asking me once for help.",
    quoteAr:
      "العربية تحس فيها أصلية مو مترجمة. أمي استخدمته من دون ما تطلب مساعدتي ولا مرة.",
  },
  {
    name: "Yousef S.",
    nameAr: "يوسف س.",
    initials: "YS",
    city: "Muscat",
    cityAr: "مسقط",
    country: "OM",
    industry: "Football",
    industryAr: "كرة قدم",
    rating: 5,
    quote:
      "I run 12 pitches. The dashboard tells me what each one earned this week. That's all I need.",
    quoteAr:
      "أشرف على 12 ملعب. اللوحة تقولي كل ملعب كم دخّل هالأسبوع. هذا كل اللي أحتاجه.",
  },
];

interface ActivityItem {
  /** Stable id so AnimatePresence can track + reorder cleanly. */
  id: string;
  kind: "booked" | "review" | "joined" | "slots" | "payout";
  countryCode: FlagCode;
  text: string;
  textAr: string;
  /** Minutes-ago at first render — gets +1 each tick. */
  minutes: number;
}

const ACTIVITY_SEED: ActivityItem[] = [
  {
    id: "a1",
    kind: "booked",
    countryCode: "KW",
    text: "Reem booked Lumen Hair · Royal Color",
    textAr: "ريم حجزت في لومن هير · خدمة الصبغ الملكي",
    minutes: 0,
  },
  {
    id: "a2",
    kind: "review",
    countryCode: "SA",
    text: "Galaxy Fitness received a 5★ review",
    textAr: "غالاكسي فتنس حصلت على تقييم 5★",
    minutes: 2,
  },
  {
    id: "a3",
    kind: "slots",
    countryCode: "KW",
    text: "Padel Point opened 4 new time slots",
    textAr: "بادل بوينت فتح 4 مواعيد جديدة",
    minutes: 5,
  },
  {
    id: "a4",
    kind: "booked",
    countryCode: "AE",
    text: "Stillpoint Yoga · Vinyasa Flow confirmed",
    textAr: "ستيلبوينت يوغا · حصة فينياسا تأكدت",
    minutes: 6,
  },
  {
    id: "a5",
    kind: "joined",
    countryCode: "QA",
    text: "New business joined: Pearl Fitness Club",
    textAr: "نشاط جديد انضم: نادي بيرل الرياضي",
    minutes: 9,
  },
  {
    id: "a6",
    kind: "payout",
    countryCode: "SA",
    text: "Galaxy Fitness · payout released to bank",
    textAr: "غالاكسي فتنس · صُرفت الدفعة إلى الحساب البنكي",
    minutes: 12,
  },
  {
    id: "a7",
    kind: "review",
    countryCode: "BH",
    text: "Northgate Clinic received a 5★ review",
    textAr: "عيادة نورثغيت حصلت على تقييم 5★",
    minutes: 15,
  },
  {
    id: "a8",
    kind: "booked",
    countryCode: "OM",
    text: "Boundary Cricket · Net Practice booked",
    textAr: "باوندري كريكت · جلسة تمرين تم حجزها",
    minutes: 18,
  },
];

const ACTIVITY_ICONS = {
  booked: CheckCircle2,
  review: Star,
  joined: Sparkles,
  slots: TrendingUp,
  payout: Heart,
} as const;

const ACTIVITY_TINT: Record<ActivityItem["kind"], string> = {
  booked: "text-emerald-300 bg-emerald-400/10 ring-emerald-400/20",
  review: "text-amber-300 bg-amber-400/10 ring-amber-400/20",
  joined: "text-blue-300 bg-blue-400/10 ring-blue-400/20",
  slots: "text-violet-300 bg-violet-400/10 ring-violet-400/20",
  payout: "text-pink-300 bg-pink-400/10 ring-pink-400/20",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SocialProof() {
  const { locale } = useI18n();
  const ar = locale === "ar";

  // Animated ticker: every 4s, rotate the oldest item out and prepend a fresh
  // one with minutes reset to 0. Pure decorative effect.
  const [activity, setActivity] = useState<ActivityItem[]>(ACTIVITY_SEED);
  useEffect(() => {
    const id = window.setInterval(() => {
      setActivity((prev) => {
        const next = prev.map((p) => ({ ...p, minutes: p.minutes + 1 }));
        // rotate: move the last item to the top with minutes=0 + tweak id
        const last = next.pop()!;
        const rotated: ActivityItem = {
          ...last,
          id: `${last.id}-${Date.now().toString(36)}`,
          minutes: 0,
        };
        return [rotated, ...next];
      });
    }, 4000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <>
      {/* Section A — Reviews */}
      <section id="reviews" className="relative z-10 border-t border-border/60">
        <div className="container py-20">
          <div className="mb-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <Heart className="h-3.5 w-3.5 text-pink-300" />
              {ar ? "محبوب في الخليج" : "Loved across the GCC"}
            </div>
            <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">
              {ar
                ? "حجوزات حقيقية. أنشطة حقيقية. عملاء حقيقيون."
                : "Real bookings. Real businesses. Real customers."}
            </h2>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
              {ar
                ? "كل أسبوع، آلاف الحجوزات تمرّ عبر بكيت من ست دول خليجية."
                : "Every week, thousands of bookings flow through Bookit from six GCC countries."}
            </p>
          </div>

          {/* Quick stats strip */}
          <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { v: "12,400+", l: ar ? "حجز مكتمل" : "bookings completed", icon: CheckCircle2, tint: "text-emerald-300" },
              { v: "4.9★", l: ar ? "متوسط التقييم" : "avg rating", icon: Star, tint: "text-amber-300" },
              { v: "1,200+", l: ar ? "نشاط مسجّل" : "businesses live", icon: Users, tint: "text-blue-300" },
              { v: "6", l: ar ? "دول خليجية" : "GCC countries", icon: Sparkles, tint: "text-violet-300" },
            ].map((s) => (
              <div
                key={s.l}
                className="rounded-2xl border border-border bg-card/60 p-4 backdrop-blur"
              >
                <div className={cn("inline-flex items-center gap-1.5", s.tint)}>
                  <s.icon className="h-3.5 w-3.5" />
                  <span className="text-xl font-semibold text-foreground sm:text-2xl">{s.v}</span>
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground/70">
                  {s.l}
                </div>
              </div>
            ))}
          </div>

          {/* Reviews grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {REVIEWS.map((r, i) => (
              <motion.div
                key={r.name}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card to-card/40 p-6 backdrop-blur"
              >
                <Quote className="absolute end-4 top-4 h-5 w-5 text-muted-foreground/30" />
                <div className="flex gap-0.5 text-amber-300">
                  {Array.from({ length: r.rating }).map((_, idx) => (
                    <Star key={idx} className="h-3.5 w-3.5 fill-current" />
                  ))}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-foreground/90">
                  {ar ? r.quoteAr : `"${r.quote}"`}
                </p>
                <div className="mt-5 flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-navy to-brand-gold text-xs font-semibold text-white shadow-lg shadow-brand-navy/30">
                    {r.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {ar ? r.nameAr : r.name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Flag code={r.country} className="h-3 w-4" />
                      <span>{ar ? r.cityAr : r.city}</span>
                      <span className="opacity-50">·</span>
                      <span>{ar ? r.industryAr : r.industry}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Section B — Community & Live Activity */}
      <section id="community" className="relative z-10 border-t border-border/60">
        <div className="container py-20">
          <div className="grid gap-8 lg:grid-cols-5">
            {/* Headline + Stats */}
            <div className="lg:col-span-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground backdrop-blur">
                <Users className="h-3.5 w-3.5 text-blue-300" />
                {ar ? "مجتمع بكيت" : "Bookit Community"}
              </div>
              <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
                {ar
                  ? "في كل دقيقة شيء يحدث على بكيت."
                  : "Something's always happening on Bookit."}
              </h2>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                {ar
                  ? "حجوزات، مراجعات، أنشطة جديدة، تحويلات إلى البنوك — كلها مباشرة من جميع أنحاء الخليج."
                  : "Bookings, reviews, new businesses signing up, payouts settling — all live from across the Gulf."}
              </p>

              <div className="mt-6 space-y-2">
                {[
                  {
                    icon: MessageCircle,
                    title: ar ? "محادثات حيّة" : "Live conversations",
                    body: ar
                      ? "اسأل أصحاب الأنشطة عن خبراتهم في مجموعات واتساب الإقليمية."
                      : "Ask other owners how they grow — regional WhatsApp groups by industry.",
                  },
                  {
                    icon: TrendingUp,
                    title: ar ? "أفضل الممارسات" : "Best-practice playbooks",
                    body: ar
                      ? "نشارك أسبوعياً ما يصلح في الصالونات والنوادي والعيادات."
                      : "Weekly playbooks on what works for salons, gyms, clinics and pitches.",
                  },
                  {
                    icon: Sparkles,
                    title: ar ? "ملاحظات تُترجم لميزات" : "Feedback that ships",
                    body: ar
                      ? "كل ميزة كبيرة بدأت بطلب من مستخدم. كل أسبوع نُطلق ما طلبتم."
                      : "Every major feature started as a user request. We ship what you ask for, weekly.",
                  },
                ].map((f) => (
                  <div
                    key={f.title}
                    className="flex items-start gap-3 rounded-2xl border border-border bg-card/60 p-3.5 backdrop-blur"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-500/20 to-emerald-400/20 ring-1 ring-white/10">
                      <f.icon className="h-4 w-4 text-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">{f.title}</div>
                      <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {f.body}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live activity feed */}
            <div className="lg:col-span-3">
              <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-card to-card/40 p-5 backdrop-blur">
                <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-[hsl(220_60%_45%_/_0.20)] blur-3xl" />
                <div className="absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-[hsl(43_75%_55%_/_0.18)] blur-3xl" />

                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                    <span className="grid h-1.5 w-1.5 place-items-center rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    {ar ? "نشاط مباشر" : "Live activity"}
                  </div>
                  <div className="text-[10px] text-muted-foreground/70">
                    {ar ? "آخر تحديث الآن" : "updated just now"}
                  </div>
                </div>

                <ul className="relative mt-4 space-y-2">
                  {/* The list key includes the locale so a language switch
                      tears down the AnimatePresence children and rebuilds
                      them — preventing the half-EN / half-AR ticker glitch
                      where exit animations from the previous locale lingered
                      in the DOM during a flip. */}
                  <AnimatePresence initial={false}>
                    {activity.slice(0, 7).map((item, idx) => {
                      const Icon = ACTIVITY_ICONS[item.kind];
                      return (
                        <motion.li
                          key={`${locale}-${item.id}`}
                          layout
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1 - idx * 0.06, y: 0 }}
                          exit={{ opacity: 0, y: 8 }}
                          transition={{ duration: 0.35 }}
                          className="flex items-start gap-3 rounded-xl border border-border/40 bg-card/60 px-3 py-2.5"
                        >
                          <div
                            className={cn(
                              "grid h-7 w-7 shrink-0 place-items-center rounded-lg ring-1",
                              ACTIVITY_TINT[item.kind],
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-medium text-foreground sm:text-sm">
                              {ar ? item.textAr : item.text}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                              <Flag code={item.countryCode} className="h-2.5 w-3.5" />
                              <span>
                                {item.minutes === 0
                                  ? ar
                                    ? "الآن"
                                    : "just now"
                                  : ar
                                    ? `قبل ${item.minutes} د`
                                    : `${item.minutes}m ago`}
                              </span>
                            </div>
                          </div>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>

                {/* Fade gradient at the bottom */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 rounded-b-3xl bg-gradient-to-t from-[#fafaf7] to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section C — Featured feedback (owner story) */}
      <section className="relative z-10 border-t border-border/60">
        <div className="container py-20">
          <div className="grid gap-6 rounded-3xl border border-border bg-gradient-to-br from-card via-card/60 to-card/40 p-8 backdrop-blur sm:p-10 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                {ar ? "قصة من العملاء" : "Owner story"}
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-brand-navy to-brand-gold text-sm font-semibold text-white shadow-lg shadow-brand-navy/30">
                  AS
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">Ahmad S.</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Flag code="KW" className="h-3 w-4" />
                    <span>{ar ? "مالك بادل بوينت — الكويت" : "Owner, Padel Point — Kuwait"}</span>
                  </div>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  { v: "+38%", l: ar ? "حجوزات" : "bookings" },
                  { v: "−71%", l: ar ? "اتصالات" : "phone calls" },
                  { v: "12m", l: ar ? "للإعداد" : "to set up" },
                ].map((s) => (
                  <div
                    key={s.l}
                    className="rounded-xl border border-border bg-card/80 p-2.5 text-center"
                  >
                    <div className="text-base font-semibold text-foreground">{s.v}</div>
                    <div className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground/80">
                      {s.l}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2">
              <Quote className="h-6 w-6 text-muted-foreground/40" />
              <blockquote className="mt-3 text-pretty text-lg leading-relaxed text-foreground sm:text-xl">
                {ar
                  ? "«قبل بكيت، كان موظف الاستقبال يجاوب على المكالمات ثماني ساعات يومياً. اليوم العملاء يحجزون بأنفسهم، الموظف صار يساعد على الأرض، ودخل الملاعب ارتفع 38٪ في ثلاثة أشهر. أهم شي إن الواجهة بالعربي تشتغل صح من اليمين لليسار — ما نحس إنها مترجمة.»"
                  : "“Before Bookit, our front desk took calls eight hours a day. Now customers self-book, the desk works on the floor, and pitch revenue climbed 38% in three months. What sealed it for us: the Arabic side feels native — not a translation.”"}
              </blockquote>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
