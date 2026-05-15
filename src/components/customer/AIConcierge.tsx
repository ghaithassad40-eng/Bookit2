import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Bot,
  CircleDot,
  CornerDownLeft,
  Dumbbell,
  Goal,
  Heart,
  Leaf,
  Loader2,
  Scissors,
  Sparkles,
  Stethoscope,
  Trophy,
  User,
} from "lucide-react";
import { useConciergeContext } from "@/hooks/useConciergeContext";
import { localConciergeReply, type ConciergeMatch } from "@/lib/concierge";
import { useI18n } from "@/hooks/useI18n";
import { pickLocale, type TranslationKey } from "@/lib/i18n";
import { useRegion } from "@/hooks/useRegion";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";

const INDUSTRY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  gym: Dumbbell,
  salon: Scissors,
  clinic: Stethoscope,
  yoga: Leaf,
  spa: Heart,
  football: Goal,
  basketball: CircleDot,
  padel: Activity,
  cricket: Trophy,
};

const STARTERS_BY_LOCALE: Record<"en" | "ar", string[]> = {
  en: [
    "5v5 football tonight",
    "Padel court Saturday",
    "Basketball court for an hour",
    "I need a haircut",
  ],
  ar: [
    "ملعب خماسي الليلة",
    "ملعب بادل السبت",
    "ملعب كرة سلة لساعة",
    "أحتاج حلاقة شعر",
  ],
};

const WELCOME_BY_LOCALE: Record<"en" | "ar", string> = {
  en: "Hi! I'm your booking concierge. Tell me what you're looking for — a haircut, a workout, a yoga class — and I'll point you to a place.",
  ar: "أهلاً! أنا مساعدك في الحجز. اكتب لي ما تبحث عنه — حلاقة، تمرين، حصة يوغا — وسأرشدك للمكان المناسب.",
};

const HEADER_LABELS_BY_LOCALE: Record<"en" | "ar", { title: string; subtitle: string; placeholder: string; online: string }> = {
  en: {
    title: "Booking concierge",
    subtitle: "Tell me what you need — I'll find a place",
    placeholder: "Ask about a service, place, or time",
    online: "Online",
  },
  ar: {
    title: "مساعد الحجز",
    subtitle: "اكتب ما تحتاج — وسأجد لك المكان",
    placeholder: "اسأل عن خدمة أو مكان أو وقت",
    online: "متاح",
  },
};

interface Message {
  id: string;
  role: "assistant" | "user";
  text: string;
  matches?: ConciergeMatch[];
}

export function AIConcierge() {
  const { data: ctx, isLoading } = useConciergeContext();
  const { locale } = useI18n();
  const { country } = useRegion();
  const lang: "en" | "ar" = locale === "ar" ? "ar" : "en";
  const labels = HEADER_LABELS_BY_LOCALE[lang];
  const starters = STARTERS_BY_LOCALE[lang];

  const initialMessage: Message = useMemo(
    () => ({ id: "welcome", role: "assistant", text: WELCOME_BY_LOCALE[lang] }),
    [lang],
  );

  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset the conversation when the user switches language, so the welcome
  // message renders in the new locale rather than mixed.
  useEffect(() => {
    setMessages([initialMessage]);
  }, [initialMessage]);

  // Apply country filter to the catalog the concierge searches against.
  const filteredCtx = useMemo(() => {
    if (!ctx) return ctx;
    if (!country || country === "ALL") return ctx;
    const businesses = ctx.businesses.filter((b) => b.country === country);
    return { ...ctx, businesses };
  }, [ctx, country]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  function ask(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      text: trimmed,
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setThinking(true);

    // Always have a valid context. If the catalog hasn't loaded, fall through
    // with empty arrays — the concierge will respond with a friendly empty
    // state rather than hanging silently.
    const safeCtx = filteredCtx ?? { businesses: [], servicesByBusiness: {}, equipment: [] };

    // simulate a brief "thinking" delay so it feels considered
    const delay = 380 + Math.random() * 280;
    window.setTimeout(() => {
      let reply;
      if (safeCtx.businesses.length === 0) {
        reply = {
          message: lang === "ar"
            ? "لا توجد أنشطة في هذا البلد بعد. جرّب اختيار بلد آخر من رأس الصفحة، أو عُد قريباً."
            : "No businesses in your selected country yet. Try a different country from the header, or check back soon.",
          matches: [],
        };
      } else {
        reply = localConciergeReply(trimmed, safeCtx, lang);
      }
      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: "followUp" in reply && reply.followUp ? `${reply.message} ${reply.followUp}` : reply.message,
        matches: reply.matches,
      };
      setMessages((m) => [...m, assistantMsg]);
      setThinking(false);
    }, delay);
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card to-card/40 backdrop-blur-xl">
      {/* header */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-navy to-brand-gold ring-1 ring-border">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">{labels.title}</div>
            <div className="text-[11px] text-muted-foreground/80">{labels.subtitle}</div>
          </div>
        </div>
        <div className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[10px] text-muted-foreground sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
          {labels.online}
        </div>
      </div>

      {/* messages */}
      <div
        ref={scrollRef}
        className="max-h-[420px] min-h-[260px] space-y-4 overflow-y-auto px-4 py-5 sm:px-6"
      >
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <Bubble message={m} />
              {m.matches && m.matches.length > 0 && (
                <div className="mt-3 grid gap-2 pl-10 sm:grid-cols-2">
                  {m.matches.map((match) => (
                    <SuggestionCard key={match.business.id} match={match} />
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {thinking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2.5 text-muted-foreground"
          >
            <div className="grid h-7 w-7 place-items-center rounded-full bg-muted">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-muted/80 px-3.5 py-2.5">
              <Dot delay={0} />
              <Dot delay={120} />
              <Dot delay={240} />
            </div>
          </motion.div>
        )}
      </div>

      {/* starters */}
      {messages.length <= 1 && !thinking && (
        <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3 sm:px-6">
          {starters.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs text-foreground/80 transition-colors hover:border-accent/40 hover:bg-muted"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex items-center gap-2 border-t border-border px-3 py-3 sm:px-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={labels.placeholder}
          className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-accent/60 focus:bg-muted disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || thinking}
          className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-brand-navy/20 transition-opacity disabled:opacity-30"
          aria-label="Send"
        >
          {thinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CornerDownLeft className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}

function Bubble({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="flex max-w-[80%] items-start gap-2.5">
          <div className="rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
            {message.text}
          </div>
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
            <User className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-navy to-brand-gold text-white ring-1 ring-border">
        <Bot className="h-3.5 w-3.5" />
      </div>
      <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2 text-sm leading-relaxed text-foreground">
        {message.text}
      </div>
    </div>
  );
}

function SuggestionCard({ match }: { match: ConciergeMatch }) {
  const { business, matchedServices, matchedEquipment } = match;
  const industryKey = business.industry?.toLowerCase() ?? "";
  const Icon = INDUSTRY_ICONS[industryKey] ?? Sparkles;
  const showService = matchedServices[0];
  const { format } = useDisplayCurrency();
  const { locale, t } = useI18n();
  const price = showService ? format(showService.price, showService.currency) : null;
  const businessName = pickLocale(locale, business.name, business.name_ar);
  const industryLabel = industryKey
    ? t(`industry.${industryKey}` as TranslationKey, business.industry)
    : business.industry;
  const serviceName = showService
    ? pickLocale(locale, showService.name, showService.name_ar)
    : null;
  // When the match came from the equipment fall-through, we surface the
  // first two equipment items as chips instead of the service chip — that
  // tells the user exactly *why* this vendor showed up.
  const equipmentChips = matchedEquipment?.slice(0, 2) ?? [];

  return (
    <Link
      to={`/business/${business.slug}`}
      className="group block rounded-2xl border border-border bg-card/80 p-4 transition-all hover:border-accent/40 hover:bg-muted"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted ring-1 ring-border">
          <Icon className="h-4 w-4 text-foreground/90" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-sm font-semibold">{businessName}</div>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-all group-hover:translate-x-0.5 group-hover:text-foreground" />
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
            {industryLabel}
          </div>
          {equipmentChips.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {equipmentChips.map((eq) => (
                <span
                  key={eq.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-200 ring-1 ring-emerald-400/20"
                >
                  {pickLocale(locale, eq.name, eq.name_ar)}
                  {eq.price != null && (
                    <span className="text-emerald-200/60">
                      +{format(eq.price, eq.currency).display}
                    </span>
                  )}
                </span>
              ))}
              {matchedEquipment && matchedEquipment.length > 2 && (
                <span className="text-[10px] text-muted-foreground/70">
                  +{matchedEquipment.length - 2}
                </span>
              )}
            </div>
          ) : showService && price && serviceName ? (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted/80 px-2 py-0.5 text-[11px] text-muted-foreground">
              {serviceName}
              <span className="text-muted-foreground/70">·</span>
              <span className="font-medium text-foreground">
                {price.converted ? `≈ ${price.display}` : price.display}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <motion.span
      animate={{ y: [0, -3, 0] }}
      transition={{ duration: 0.9, repeat: Infinity, delay: delay / 1000 }}
      className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
    />
  );
}
