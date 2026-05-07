import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Bot,
  CornerDownLeft,
  Dumbbell,
  Heart,
  Leaf,
  Loader2,
  Scissors,
  Sparkles,
  Stethoscope,
  User,
} from "lucide-react";
import { useConciergeContext } from "@/hooks/useConciergeContext";
import { localConciergeReply, type ConciergeMatch } from "@/lib/concierge";
import { formatCurrency } from "@/lib/utils";

const INDUSTRY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  gym: Dumbbell,
  salon: Scissors,
  clinic: Stethoscope,
  yoga: Leaf,
  spa: Heart,
};

const STARTERS = [
  "I need a haircut",
  "Yoga class tonight",
  "Personal training",
  "Doctor visit this week",
];

interface Message {
  id: string;
  role: "assistant" | "user";
  text: string;
  matches?: ConciergeMatch[];
}

const initialMessage: Message = {
  id: "welcome",
  role: "assistant",
  text:
    "Hi! I'm your booking concierge. Tell me what you're looking for — a haircut, a workout, a yoga class — and I'll point you to a place.",
};

export function AIConcierge() {
  const { data: ctx, isLoading } = useConciergeContext();
  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    const safeCtx = ctx ?? { businesses: [], servicesByBusiness: {} };

    // simulate a brief "thinking" delay so it feels considered
    const delay = 380 + Math.random() * 280;
    window.setTimeout(() => {
      let reply;
      if (safeCtx.businesses.length === 0) {
        reply = {
          message:
            "We're still onboarding our first wave of places — no live bookings yet. Check back soon, or reach out if there's a specific business you'd like to see here.",
          matches: [],
        };
      } else {
        reply = localConciergeReply(trimmed, safeCtx);
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
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.01] backdrop-blur-xl">
      {/* header */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-blue-500/30 to-emerald-400/30 ring-1 ring-white/15">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">Booking concierge</div>
            <div className="text-[11px] text-white/50">Tell me what you need — I'll find a place</div>
          </div>
        </div>
        <div className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/60 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
          Online
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
            className="flex items-center gap-2.5 text-white/60"
          >
            <div className="grid h-7 w-7 place-items-center rounded-full bg-white/[0.08]">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-white/[0.05] px-3.5 py-2.5">
              <Dot delay={0} />
              <Dot delay={120} />
              <Dot delay={240} />
            </div>
          </motion.div>
        )}
      </div>

      {/* starters */}
      {messages.length <= 1 && !thinking && (
        <div className="flex flex-wrap gap-2 border-t border-white/10 px-4 py-3 sm:px-6">
          {STARTERS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/80 transition-colors hover:border-white/20 hover:bg-white/[0.06]"
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
        className="flex items-center gap-2 border-t border-white/10 px-3 py-3 sm:px-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about a service, place, or time"
          className="flex-1 rounded-xl border border-transparent bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/20 focus:bg-white/[0.06] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || thinking}
          className="grid h-10 w-10 place-items-center rounded-xl bg-white text-black shadow-lg shadow-white/10 transition-opacity disabled:opacity-30"
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
          <div className="rounded-2xl rounded-tr-sm bg-white px-3.5 py-2 text-sm text-black">
            {message.text}
          </div>
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[0.08] text-white/70">
            <User className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-500/40 to-emerald-400/40 text-white ring-1 ring-white/15">
        <Bot className="h-3.5 w-3.5" />
      </div>
      <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white/[0.05] px-3.5 py-2 text-sm leading-relaxed text-white/90">
        {message.text}
      </div>
    </div>
  );
}

function SuggestionCard({ match }: { match: ConciergeMatch }) {
  const { business, matchedServices } = match;
  const Icon = INDUSTRY_ICONS[business.industry?.toLowerCase()] ?? Sparkles;
  const showService = matchedServices[0];

  return (
    <Link
      to={`/business/${business.slug}`}
      className="group block rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-all hover:border-white/25 hover:bg-white/[0.06]"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] ring-1 ring-white/10">
          <Icon className="h-4 w-4 text-white/85" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-sm font-semibold">{business.name}</div>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/40 transition-all group-hover:translate-x-0.5 group-hover:text-white" />
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-white/40">
            {business.industry}
          </div>
          {showService && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] text-white/70">
              {showService.name}
              <span className="text-white/40">·</span>
              <span className="font-medium text-white/90">
                {formatCurrency(showService.price, showService.currency)}
              </span>
            </div>
          )}
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
      className="h-1.5 w-1.5 rounded-full bg-white/60"
    />
  );
}
