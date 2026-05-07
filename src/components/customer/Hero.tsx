import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { BusinessRow, CopyJson } from "@/lib/database.types";

interface Props {
  business: BusinessRow;
  copy: CopyJson;
}

export function Hero({ business, copy }: Props) {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-accent/30 blur-3xl" />
        <div className="absolute -bottom-40 right-0 h-[320px] w-[520px] rounded-full bg-secondary/20 blur-3xl" />
      </div>

      <div className="container py-16 sm:py-24 md:py-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span>{business.name}</span>
          </div>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            {copy.heroTitle}
          </h1>
          <p className="mt-5 text-pretty text-base text-muted-foreground sm:text-lg">
            {copy.heroSubtitle}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link to={`/business/${business.slug}/book`}>
                {copy.ctaText}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#services">Explore services</a>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
