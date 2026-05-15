import { useOutletContext, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Quote, Star } from "lucide-react";
import type { BusinessRow, BusinessConfigRow } from "@/lib/database.types";
import { Hero } from "@/components/customer/Hero";
import { ServiceCard } from "@/components/customer/ServiceCard";
import { StaffCard } from "@/components/customer/StaffCard";
import { LocationCard } from "@/components/customer/LocationCard";
import { useI18n } from "@/hooks/useI18n";
import { useServices } from "@/hooks/useServices";
import { useStaff } from "@/hooks/useStaff";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface Ctx {
  business: BusinessRow;
  config: BusinessConfigRow;
}

export default function Landing() {
  const { business, config } = useOutletContext<Ctx>();
  const { t, dir, locale } = useI18n();
  const { data: services, isLoading: servicesLoading } = useServices(business.id);
  const { data: staff, isLoading: staffLoading } = useStaff(business.id);
  const layout = config.layout_json;

  const testimonials =
    locale === "ar"
      ? [
          { name: "علي و.", quote: "استغرق الحجز عشر ثوانٍ، والتذكيرات رائعة." },
          { name: "بريا ر.", quote: "أسلس تجربة مررت بها مع نشاط محلّي." },
          { name: "سامي ت.", quote: "أحببت إمكانية اختيار المختصّ المفضّل لديّ." },
        ]
      : [
          { name: "Alex W.", quote: "Booking took ten seconds. The reminders are great too." },
          { name: "Priya R.", quote: "Smoothest experience I've had with any local business." },
          { name: "Sam T.", quote: "I love that I can pick my favorite specialist." },
        ];

  return (
    <div>
      <Hero business={business} copy={config.copy_json} />

      {layout.showServicesPreview !== false && (
        <section id="services" className="container py-12 sm:py-20">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold sm:text-3xl">{t("landing.services")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("landing.servicesSubtitle")}
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link to={`/business/${business.slug}/book`}>
                {t("landing.seeAll")} <ArrowRight className={dir === "rtl" ? "h-4 w-4 rotate-180" : "h-4 w-4"} />
              </Link>
            </Button>
          </div>
          {servicesLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-44 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {services?.slice(0, 6).map((s) => <ServiceCard key={s.id} service={s} />)}
            </div>
          )}
        </section>
      )}

      {layout.showStaff !== false && (
        <section className="container py-12 sm:py-20">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold sm:text-3xl">{t("landing.meetTheTeam")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("landing.meetTheTeamSubtitle")}
            </p>
          </div>
          {staffLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {staff?.slice(0, 6).map((p) => <StaffCard key={p.id} staff={p} />)}
            </div>
          )}
        </section>
      )}

      {layout.showTestimonials && (
        <section className="container py-12 sm:py-20">
          <h2 className="mb-8 text-2xl font-semibold sm:text-3xl">{t("landing.whatGuestsSay")}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {testimonials.map((review) => (
              <motion.div
                key={review.name}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-2xl border border-border bg-card/60 p-6 shadow-sm"
              >
                <Quote className="h-5 w-5 text-accent" />
                <p className="mt-3 text-sm text-foreground/90">"{review.quote}"</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{review.name}</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <section className="container pb-12">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold sm:text-3xl">{t("common.findUs")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("common.findUsDescription")}
          </p>
        </div>
        <LocationCard business={business} />
      </section>

      <section className="container pb-20">
        <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-border bg-card/60 p-8 text-center sm:flex-row sm:text-start">
          <div>
            <h3 className="text-xl font-semibold">{t("landing.readyToBook")}</h3>
            <p className="text-sm text-muted-foreground">{t("landing.readyToBookSubtitle")}</p>
          </div>
          <Button size="lg" asChild>
            <Link to={`/business/${business.slug}/book`}>
              {config.copy_json.ctaText}
              <ArrowRight className={dir === "rtl" ? "h-4 w-4 rotate-180" : "h-4 w-4"} />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
