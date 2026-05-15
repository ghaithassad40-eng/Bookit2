import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  CircleDot,
  Dumbbell,
  Goal,
  Heart,
  Leaf,
  MessageSquare,
  Package,
  Scissors,
  Sparkles,
  Stethoscope,
  Trophy,
  Clock,
  Palette,
  Smartphone,
} from "lucide-react";
import { AIConcierge } from "@/components/customer/AIConcierge";
import { EquipmentSearchDialog } from "@/components/customer/EquipmentSearchDialog";
import { WelcomePicker } from "@/components/customer/WelcomePicker";
import { RegionPill } from "@/components/customer/RegionPill";
import { SocialProof } from "@/components/customer/SocialProof";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { BusinessRow } from "@/lib/database.types";
import { DEMO_BUSINESSES } from "@/lib/demoData";
import { applyBusinessOverrides } from "@/hooks/usePlatformBusinesses";
import { useRegion } from "@/hooks/useRegion";
import { useI18n } from "@/hooks/useI18n";
import { pickLocale } from "@/lib/i18n";
import { countryMeta } from "@/lib/region";

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
  const [equipmentSearchOpen, setEquipmentSearchOpen] = useState(false);
  const [allBusinesses, setAllBusinesses] = useState<BusinessRow[] | null>(null);
  const { country, setCountry } = useRegion();
  const { locale, t } = useI18n();
  const regionMeta = country ? countryMeta(country) : null;

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Demo mode: apply platform-admin overrides on top of the seeded list
      // so status changes from /admin/platform show up here without a
      // round-trip.
      setAllBusinesses(applyBusinessOverrides(DEMO_BUSINESSES));
      return;
    }
    supabase
      .from("businesses")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(40)
      .then(({ data }) => {
        const live = (data as BusinessRow[]) ?? [];
        setAllBusinesses(
          live.length > 0 ? live : applyBusinessOverrides(DEMO_BUSINESSES),
        );
      });
  }, []);

  // Apply two filters before the customer ever sees the catalogue:
  //   1. Approval status — only businesses approved by the platform admin
  //      are visible. Rows without a status (older prod data) are treated
  //      as approved so we don't silently hide existing customers.
  //   2. Country — respects the customer's region pick.
  const businesses = (() => {
    if (allBusinesses === null) return null;
    const approved = allBusinesses.filter(
      (b) => !b.status || b.status === "approved",
    );
    if (!country || country === "ALL") return approved;
    return approved.filter((b) => b.country === country);
  })();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#fafaf7] text-foreground">
      {/* First-visit country + language prompt */}
      <WelcomePicker />

      {/* AI-powered equipment search ("find me a vendor with a 4K monitor") */}
      <EquipmentSearchDialog
        open={equipmentSearchOpen}
        onOpenChange={setEquipmentSearchOpen}
      />

      {/* Soft ambient glow — gold + navy tints on cream. The pattern dots
          stay but use the navy hue at very low opacity so they read as
          texture rather than noise. */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[640px] w-[1100px] -translate-x-1/2 rounded-full bg-[hsl(43_75%_55%_/_0.18)] blur-[120px]" />
        <div className="absolute top-[40%] -right-40 h-[420px] w-[640px] rounded-full bg-[hsl(220_60%_50%_/_0.10)] blur-[120px]" />
        <div className="absolute bottom-0 left-0 h-[420px] w-[640px] rounded-full bg-[hsl(43_75%_55%_/_0.10)] blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, hsl(220 49% 21%) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* nav */}
      <header className="relative z-10 border-b border-border/60">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <img
              src="/Bookit.png"
              alt="Bookit"
              className="h-9 w-9 rounded-lg object-contain bg-white p-0.5 shadow-lg shadow-brand-gold/20"
            />
            <span className="text-base">Bookit</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">{t("home.nav.features")}</a>
            <a href="#workspaces" className="hover:text-foreground">{t("home.nav.liveDemos")}</a>
            <a href="#reviews" className="hover:text-foreground">{t("home.nav.reviews")}</a>
            <a href="#community" className="hover:text-foreground">{t("home.nav.community")}</a>
            <a href="#how" className="hover:text-foreground">{t("home.nav.howItWorks")}</a>
          </nav>
          {/* No sign-in here — customers don't sign in to book.
              Business owners reach the admin via the "List your business" CTA. */}
          <div className="flex items-center gap-2">
            <RegionPill className="border-border bg-card text-foreground/90 hover:bg-muted" />
            <Link
              to="/admin/login"
              className="hidden rounded-full border border-border bg-card/80 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur transition-colors hover:bg-muted hover:text-foreground md:inline-block"
            >
              {t("home.nav.listBusiness")}
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
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <span className="grid h-1.5 w-1.5 place-items-center rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              {t("home.taglineBadge")}
            </div>

            <h1 className="mt-6 text-balance bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-[2.5rem] font-semibold leading-[1.05] tracking-tight text-transparent sm:text-6xl md:text-7xl md:leading-[1.05]">
              {t("home.headline")}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
              {t("home.subhead")}
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                asChild
                className="h-12 bg-primary px-6 text-primary-foreground shadow-xl shadow-brand-navy/20 hover:bg-primary/90"
              >
                <a href="#concierge">
                  {t("home.askConcierge")} <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
              <Button
                size="lg"
                asChild
                variant="outline"
                className="h-12 px-6"
              >
                <a href="#workspaces">{t("home.browseAll")}</a>
              </Button>
            </div>

            {/* stats */}
            <div className="mx-auto mt-14 grid max-w-2xl grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-card/60 backdrop-blur">
              {[
                { v: "10+", k: "home.stats.industries" as const },
                { v: "<1s", k: "home.stats.toBook" as const },
                { v: "24/7", k: "home.stats.alwaysOpen" as const },
              ].map((s) => (
                <div key={s.k} className="px-4 py-5 text-center">
                  <div className="text-xl font-semibold sm:text-2xl">{s.v}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground/80">
                    {t(s.k)}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* AI concierge */}
      <section id="concierge" className="relative z-10 border-t border-border/60">
        <div className="container py-16 sm:py-20">
          <div className="mx-auto max-w-2xl">
            <div className="mb-6 text-center">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground backdrop-blur">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                {t("home.concierge.badge")}
              </div>
              <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">
                {t("home.concierge.heading")}
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">
                {t("home.concierge.body")}
              </p>
            </div>
            <AIConcierge />

            {/* AI equipment search — "find me a vendor with this gear" */}
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setEquipmentSearchOpen(true)}
                className="group inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground/80 backdrop-blur transition-all hover:bg-muted hover:text-foreground"
              >
                <Package className="h-3.5 w-3.5 text-emerald-300 transition-transform group-hover:scale-110" />
                {t("home.equipmentSearchCta")}
                <ArrowRight className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* live demos */}
      <section id="workspaces" className="relative z-10 border-t border-border/60">
        <div className="container py-20">
          <div className="mb-10 flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">
                <span>{t("home.places.eyebrow")}</span>
                {regionMeta && regionMeta.code !== "ALL" && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 normal-case tracking-normal text-muted-foreground">
                    <span aria-hidden>{regionMeta.flag}</span>
                    {locale === "ar" ? regionMeta.nameAr : regionMeta.name}
                  </span>
                )}
              </div>
              <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">
                {t("home.places.heading")}
              </h2>
            </div>
          </div>

          {businesses === null ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-44 bg-card" />
              ))}
            </div>
          ) : businesses.length === 0 ? (
            // Empty: distinguish between "no businesses at all" and "no
            // businesses in the selected country yet".
            country && country !== "ALL" && (allBusinesses?.length ?? 0) > 0 ? (
              <div className="rounded-3xl border border-border bg-gradient-to-br from-white/[0.04] to-card/60 p-10 text-center backdrop-blur">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-muted text-2xl">
                  {regionMeta?.flag}
                </div>
                <h3 className="mt-4 text-lg font-semibold">{t("region.noBusinessesYet")}</h3>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                  {t("region.noBusinessesBody")}
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    className="border-border bg-card text-foreground hover:bg-muted"
                    onClick={() => setCountry("ALL")}
                  >
                    🌍 {t("welcome.allCountries")}
                  </Button>
                </div>
              </div>
            ) : (
              <DemoEmptyState configured={isSupabaseConfigured} />
            )
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {businesses.map((b, i) => {
                const industryKey = b.industry?.toLowerCase();
                const Icon = INDUSTRY_ICONS[industryKey] ?? Sparkles;
                const industryLabel = industryKey
                  ? t(`industry.${industryKey}` as
                      | "industry.gym"
                      | "industry.salon"
                      | "industry.clinic"
                      | "industry.yoga"
                      | "industry.spa"
                      | "industry.football"
                      | "industry.basketball"
                      | "industry.padel"
                      | "industry.cricket",
                      b.industry)
                  : b.industry;
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
                      className="group relative block h-full overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-white/[0.04] to-card/60 p-6 transition-all hover:border-accent/40 hover:from-card"
                    >
                      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[hsl(43_75%_55%_/_0.18)] blur-3xl transition-opacity group-hover:opacity-100" />
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-muted backdrop-blur">
                        <Icon className="h-5 w-5 text-foreground/80" />
                      </div>
                      <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                        {industryLabel}
                      </div>
                      <div className="mt-1.5 text-lg font-semibold leading-snug">
                        {pickLocale(locale, b.name, b.name_ar)}
                      </div>
                      <div className="mt-6 inline-flex items-center text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                        {t("home.places.openBookingPage")}
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
      <section id="features" className="relative z-10 border-t border-border/60">
        <div className="container py-20">
          <div className="mb-10 max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">
              {t("home.features.eyebrow")}
            </div>
            <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">
              {t("home.features.heading")}
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Clock,
                title: t("home.features.neverDoubleBook.title"),
                body: t("home.features.neverDoubleBook.body"),
              },
              {
                icon: Palette,
                title: t("home.features.brand.title"),
                body: t("home.features.brand.body"),
              },
              {
                icon: Smartphone,
                title: t("home.features.mobile.title"),
                body: t("home.features.mobile.body"),
              },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-blue-500/20 to-emerald-400/20 ring-1 ring-white/10">
                  <f.icon className="h-5 w-5 text-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* social proof: reviews, community, owner story */}
      <SocialProof />

      {/* how it works */}
      <section id="how" className="relative z-10 border-t border-border/60">
        <div className="container py-20">
          <div className="mb-10 max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">
              {t("home.how.eyebrow")}
            </div>
            <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">{t("home.how.heading")}</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { n: "01", title: t("home.how.step1.title"), body: t("home.how.step1.body") },
              { n: "02", title: t("home.how.step2.title"), body: t("home.how.step2.body") },
              { n: "03", title: t("home.how.step3.title"), body: t("home.how.step3.body") },
            ].map((s) => (
              <div
                key={s.n}
                className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur"
              >
                <div className="text-xs font-mono text-muted-foreground/60">{s.n}</div>
                <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 rounded-3xl border border-border bg-gradient-to-br from-card to-card/60 p-8 backdrop-blur sm:flex-row sm:p-10">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                {t("home.listing.eyebrow")}
              </div>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">{t("home.listing.title")}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {t("home.listing.body")}
              </p>
            </div>
            <Button
              asChild
              size="lg"
              className="h-12 bg-primary px-6 text-primary-foreground hover:bg-primary/90"
            >
              <Link to="/admin/login">
                {t("home.listing.cta")} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="relative z-10 border-t border-border/60">
        <div className="container flex flex-col items-center justify-between gap-3 py-8 text-xs text-muted-foreground/80 sm:flex-row">
          <div className="flex items-center gap-2">
            <img
              src="/Bookit.png"
              alt="Bookit"
              className="h-5 w-5 rounded bg-white/95 object-contain p-px"
            />
            <span>© {new Date().getFullYear()} {t("home.footer.copyright")}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-muted-foreground">{t("home.footer.privacy")}</Link>
            <Link to="/terms" className="hover:text-muted-foreground">{t("home.footer.terms")}</Link>
            <span>{t("home.footer.tagline")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function DemoEmptyState({ configured: _ }: { configured: boolean }) {
  const { t } = useI18n();
  return (
    <div className="rounded-3xl border border-border bg-gradient-to-br from-white/[0.04] to-card/60 p-12 text-center backdrop-blur">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-muted">
        <Sparkles className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-xl font-semibold">{t("home.places.empty.title")}</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
        {t("home.places.empty.body")}
      </p>
    </div>
  );
}
