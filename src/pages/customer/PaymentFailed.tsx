import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CreditCard,
  Hash,
  HelpCircle,
  Mail,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import type { BusinessRow, BusinessConfigRow } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";

interface Ctx {
  business: BusinessRow;
  config: BusinessConfigRow;
}

export default function PaymentFailed() {
  const { business } = useOutletContext<Ctx>();
  const { t } = useI18n();

  const COMMON_REASONS = [
    { icon: CreditCard, title: t("fail.cardDeclined"),    body: t("fail.cardDeclinedBody") },
    { icon: ShieldAlert, title: t("fail.authFailed"),     body: t("fail.authFailedBody") },
    { icon: RefreshCw,   title: t("fail.connectionLost"), body: t("fail.connectionLostBody") },
  ];
  const [params] = useSearchParams();
  const reference = params.get("ref");
  const reason = params.get("reason");
  const code = params.get("code");

  return (
    <div className="container max-w-2xl py-10 sm:py-16">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-center"
      >
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 16, stiffness: 220, delay: 0.1 }}
          className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-rose-500/15 text-rose-500 ring-8 ring-rose-500/5"
        >
          <XCircle className="h-10 w-10" />
        </motion.div>
        <Badge variant="destructive" className="mb-3 px-3 py-1 text-xs">
          {t("fail.title")}
        </Badge>
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("fail.headline")}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {t("fail.reassurance")}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card>
          <div className="flex items-center gap-3 border-b border-border/60 bg-gradient-to-br from-rose-500/5 to-transparent p-5">
            {business.logo_url ? (
              <img src={business.logo_url} alt={business.name} className="h-10 w-10 rounded-xl object-cover" />
            ) : (
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-500/15 text-sm font-bold text-rose-600 dark:text-rose-300">
                {initials(business.name)}
              </div>
            )}
            <div>
              <div className="text-sm font-semibold">{business.name}</div>
              <div className="text-xs text-muted-foreground">{t("fail.bookingUnconfirmed")}</div>
            </div>
          </div>

          <CardContent className="space-y-5 p-5">
            {/* Reason banner */}
            <div className="flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
              <div className="space-y-1">
                <div className="font-medium text-foreground">
                  {reason || t("fail.genericReason")}
                </div>
                {code && (
                  <div className="font-mono text-[11px] text-muted-foreground">{t("fail.codeLabel")}: {code}</div>
                )}
              </div>
            </div>

            {reference && (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/30 p-4 text-sm">
                <div className="inline-flex items-center gap-2 text-muted-foreground">
                  <Hash className="h-4 w-4" /> {t("fail.attemptReference")}
                </div>
                <span className="font-mono font-semibold">{reference}</span>
              </div>
            )}

            <div>
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {t("fail.commonCauses")}
              </div>
              <ul className="space-y-2">
                {COMMON_REASONS.map((r) => (
                  <li key={r.title} className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-3">
                    <div className="mt-0.5 grid h-7 w-7 place-items-center rounded-lg bg-muted/50 text-muted-foreground">
                      <r.icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="text-sm">
                      <div className="font-medium">{r.title}</div>
                      <div className="text-xs text-muted-foreground">{r.body}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border/60 p-4 text-sm">
              <HelpCircle className="mt-0.5 h-4 w-4 text-accent" />
              <div className="text-muted-foreground">
                {t("fail.helpHint")}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="mt-8 flex flex-col items-stretch justify-center gap-2 sm:flex-row">
        <Button asChild size="lg">
          <Link to={`/business/${business.slug}/book`}>
            <RefreshCw className="h-4 w-4" />
            {t("common.tryAgain")}
          </Link>
        </Button>
        <Button variant="outline" asChild size="lg">
          <Link to={`/business/${business.slug}`}>
            <ArrowLeft className="h-4 w-4" />
            {t("nav.backTo")} {business.name}
          </Link>
        </Button>
        <Button variant="ghost" asChild size="lg">
          <a href={`mailto:support@${business.slug}.bk-it.ai`}>
            <Mail className="h-4 w-4" />
            {t("common.contactSupport")}
          </a>
        </Button>
      </div>
    </div>
  );
}
