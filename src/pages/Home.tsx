import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  CalendarCheck,
  CircleDot,
  Dumbbell,
  Goal,
  Heart,
  Leaf,
  MessageSquare,
  Scissors,
  Sparkles,
  Stethoscope,
  Trophy,
  Clock,
  Palette,
  Smartphone,
} from "lucide-react";
import { AIConcierge } from "@/components/customer/AIConcierge";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { BusinessRow } from "@/lib/database.types";
import { DEMO_BUSINESSES } from "@/lib/demoData";

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

export default function Home() {
  const [businesses, setBusinesses] = useState<BusinessRow[] | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setBusinesses(DEMO_BUSINESSES);
      return;
    }
    supabase
      .from("businesses")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => {
        const live = (data as BusinessRow[]) ?? [];
        setBusinesses(live.length > 0 ? live : DEMO_BUSINESSES);
      });
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0f] text-white">
      {/* ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[640px] w-[1100px] -translate-x-1/2 rounded-full bg-blue-500/15 blur-[120px]" />
        <div className="absolute top-[40%] -right-40 h-[420px] w-[640px] rounded-full bg-emerald-400/10 blur-[120px]" />
        <div className="absolute bottom-0 left-0 h-[420px] w-[640px] rounded-full bg-violet-500/10 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* nav */}
      <header className="relative z-10 border-b border-white/5">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-emerald-400 shadow-lg shadow-blue-500/25">
              <CalendarCheck className="h-4 w-4 text-white" />
            </div>
            <span className="text-base">Bookit</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-white/60 md:flex">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#workspaces" className="hover:text-white">Live demos</a>
            <a href="#how" className="hover:text-white">How it works</a>
          </nav>
          {/* No sign-in here — customers don't sign in to book.
              Business owners reach the admin via the "List your business" CTA. */}
          <div className="hidden md:block">
            <Link
              to="/admin/login"
              className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs font-medium text-white/70 backdrop-blur transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              List your business
            </Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="relative z-10">
        <div className="container py-20 sm:py-28 md:py-36">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="mx-auto max-w-4xl text-center"
          >
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/70 backdrop-blur">
              <span className="grid h-1.5 w-1.5 place-items-center rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              Now taking bookings — set up in minutes
            </div>

            <h1 className="mt-6 text-balance bg-gradient-to-b from-white to-white/60 bg-clip-text text-[2.5rem] font-semibold leading-[1.05] tracking-tight text-transparent sm:text-6xl md:text-7xl md:leading-[1.05]">
              Bookings, beautifully on autopilot.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-base text-white/60 sm:text-lg">
              The modern way to take appointments — for gyms, salons, clinics,
              studios and more. Your brand, your hours, your team. Customers book
              in seconds.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                asChild
                className="h-12 bg-white px-6 text-black shadow-2xl shadow-white/10 hover:bg-white/90"
              >
                <a href="#concierge">
                  Ask the concierge <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
              <Button
                size="lg"
                asChild
                variant="outline"
                className="h-12 border-white/10 bg-white/[0.03] px-6 text-white backdrop-blur hover:bg-white/[0.08]"
              >
                <a href="#workspaces">Browse all places</a>
              </Button>
            </div>

            {/* stats */}
            <div className="mx-auto mt-14 grid max-w-2xl grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur">
              {[
                { v: "10+", l: "industries" },
                { v: "<1s", l: "to book" },
                { v: "24/7", l: "always open" },
              ].map((s) => (
                <div key={s.l} className="px-4 py-5 text-center">
                  <div className="text-xl font-semibold sm:text-2xl">{s.v}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-wider text-white/40">
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* AI concierge */}
      <section id="concierge" className="relative z-10 border-t border-white/5">
        <div className="container py-16 sm:py-20">
          <div className="mx-auto max-w-2xl">
            <div className="mb-6 text-center">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/70 backdrop-blur">
                <MessageSquare className="h-3.5 w-3.5 text-white/70" />
                Find your place in seconds
              </div>
              <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">
                Not sure where to book? Ask.
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-sm text-white/60 sm:text-base">
                Describe what you need in your own words. The concierge will
                surface places that match.
              </p>
            </div>
            <AIConcierge />
          </div>
        </div>
      </section>

      {/* live demos */}
      <section id="workspaces" className="relative z-10 border-t border-white/5">
        <div className="container py-20">
          <div className="mb-10 flex items-end justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                Browse places
              </div>
              <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">
                Pick a place, book in seconds.
              </h2>
            </div>
          </div>

          {businesses === null ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-44 bg-white/[0.04]" />
              ))}
            </div>
          ) : businesses.length === 0 ? (
            <DemoEmptyState configured={isSupabaseConfigured} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {businesses.map((b, i) => {
                const Icon = INDUSTRY_ICONS[b.industry?.toLowerCase()] ?? Sparkles;
                return (
                  <motion.div
                    key={b.id}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.06 }}
                  >
                    <Link
                      to={`/business/${b.slug}`}
                      className="group relative block h-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6 transition-all hover:border-white/20 hover:from-white/[0.06]"
                    >
                      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-blue-500/15 blur-3xl transition-opacity group-hover:opacity-100" />
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.06] backdrop-blur">
                        <Icon className="h-5 w-5 text-white/80" />
                      </div>
                      <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                        {b.industry}
                      </div>
                      <div className="mt-1.5 text-lg font-semibold leading-snug">
                        {b.name}
                      </div>
                      <div className="mt-6 inline-flex items-center text-xs font-medium text-white/70 transition-colors group-hover:text-white">
                        Open booking page
                        <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* features */}
      <section id="features" className="relative z-10 border-t border-white/5">
        <div className="container py-20">
          <div className="mb-10 max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
              Why teams switch
            </div>
            <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">
              Everything your front desk does — without the front desk.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Clock,
                title: "Never double-book",
                body: "Slots lock the moment a customer reserves. No overlaps, no awkward calls, no embarrassment.",
              },
              {
                icon: Palette,
                title: "Match your brand",
                body: "Choose colors, fonts and copy until the booking page feels like yours — not a third-party form.",
              },
              {
                icon: Smartphone,
                title: "Built for phones",
                body: "Customers book in under a minute on mobile. Big tap targets, no zooming, no friction.",
              },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-blue-500/20 to-emerald-400/20 ring-1 ring-white/10">
                  <f.icon className="h-5 w-5 text-white/90" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/60">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="relative z-10 border-t border-white/5">
        <div className="container py-20">
          <div className="mb-10 max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
              How it works
            </div>
            <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">From signup to booked in three steps.</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { n: "01", t: "Create your page", b: "Sign up and get your own branded booking link to share." },
              { n: "02", t: "Add services & team", b: "Set your offerings, prices and hours — change them anytime." },
              { n: "03", t: "Get booked", b: "Customers tap, pick a time, and you're confirmed instantly." },
            ].map((s) => (
              <div
                key={s.n}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur"
              >
                <div className="text-xs font-mono text-white/30">{s.n}</div>
                <h3 className="mt-2 text-lg font-semibold">{s.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/60">{s.b}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.01] p-8 backdrop-blur sm:flex-row sm:p-10">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                For business owners
              </div>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">List your business</h3>
              <p className="mt-1.5 text-sm text-white/60">
                Set up your own booking page in minutes.
              </p>
            </div>
            <Button
              asChild
              size="lg"
              className="h-12 bg-white px-6 text-black hover:bg-white/90"
            >
              <Link to="/admin/login">
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="relative z-10 border-t border-white/5">
        <div className="container flex flex-col items-center justify-between gap-2 py-8 text-xs text-white/40 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="grid h-5 w-5 place-items-center rounded bg-gradient-to-br from-blue-500 to-emerald-400">
              <CalendarCheck className="h-3 w-3 text-white" />
            </div>
            <span>© {new Date().getFullYear()} Bookit</span>
          </div>
          <span>Built for service businesses everywhere</span>
        </div>
      </footer>
    </div>
  );
}

function DemoEmptyState({ configured: _ }: { configured: boolean }) {
  // Same UI in every state — avoid leaking implementation details to visitors.
  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-12 text-center backdrop-blur">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.06]">
        <Sparkles className="h-5 w-5 text-white/70" />
      </div>
      <h3 className="mt-4 text-xl font-semibold">Demos coming online soon</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-white/60">
        Live demo workspaces will appear here. Check back shortly.
      </p>
    </div>
  );
}
