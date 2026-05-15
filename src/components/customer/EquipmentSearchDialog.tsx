import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Loader2,
  Package,
  Search,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  useEquipmentSearch,
  type EquipmentSearchResult,
} from "@/hooks/useEquipmentSearch";
import { useI18n } from "@/hooks/useI18n";
import { useRegion } from "@/hooks/useRegion";
import { pickLocale } from "@/lib/i18n";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { initials } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EXAMPLE_QUERIES_EN = [
  "I need a 4K monitor and ergonomic chair",
  "Whiteboard and color printing for a meeting",
  "Padel racket rental",
  "Conference camera for a Zoom call",
];

const EXAMPLE_QUERIES_AR = [
  "أحتاج شاشة 4K وكرسي مريح",
  "لوح أبيض وطباعة ملوّنة لاجتماع",
  "استئجار مضرب بادل",
  "كاميرا مؤتمرات لمكالمة Zoom",
];

export function EquipmentSearchDialog({ open, onOpenChange }: Props) {
  const { t, locale } = useI18n();
  const { country } = useRegion();
  const search = useEquipmentSearch();
  const [query, setQuery] = useState("");
  const examples = locale === "ar" ? EXAMPLE_QUERIES_AR : EXAMPLE_QUERIES_EN;

  async function run(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    await search.mutateAsync({
      query: trimmed,
      country: country && country !== "ALL" ? country : undefined,
      language_hint: locale === "ar" ? "ar" : "en",
    });
  }

  const results = search.data ?? [];
  const showEmpty = search.isSuccess && results.length === 0 && !search.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-blue-500/15 to-emerald-400/15 text-accent">
            <Sparkles className="h-5 w-5" />
          </div>
          <DialogTitle>{t("equipmentSearch.title")}</DialogTitle>
          <DialogDescription>{t("equipmentSearch.subtitle")}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(query);
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("equipmentSearch.placeholder")}
              className="ps-9"
              autoFocus
            />
          </div>
          <Button type="submit" disabled={search.isPending || !query.trim()}>
            {search.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("equipmentSearch.searching")}
              </>
            ) : (
              t("equipmentSearch.search")
            )}
          </Button>
        </form>

        {/* Example chips — visible until the first result lands. */}
        {!search.data && !search.isPending && (
          <div className="flex flex-wrap gap-2 pt-1">
            {examples.map((ex) => (
              <button
                key={ex}
                onClick={() => void run(ex)}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        <div className="max-h-[420px] overflow-y-auto pr-1">
          <AnimatePresence mode="wait">
            {search.isPending && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center py-12 text-sm text-muted-foreground"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="ms-2">{t("equipmentSearch.thinking")}</span>
              </motion.div>
            )}

            {showEmpty && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-12 text-center"
              >
                <Package className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                <p className="text-sm font-medium">{t("equipmentSearch.emptyTitle")}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("equipmentSearch.emptyBody")}
                </p>
              </motion.div>
            )}

            {!search.isPending && results.length > 0 && (
              <motion.ul
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2 pt-3"
              >
                {results.map((r) => (
                  <ResultCard key={r.business.id} result={r} onPick={() => onOpenChange(false)} />
                ))}
                <li className="pt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {results[0]?.source === "ai"
                    ? t("equipmentSearch.poweredAi")
                    : t("equipmentSearch.poweredLocal")}
                </li>
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResultCard({
  result,
  onPick,
}: {
  result: EquipmentSearchResult;
  onPick: () => void;
}) {
  const { locale } = useI18n();
  const { format } = useDisplayCurrency();
  const b = result.business;
  const name = pickLocale(locale, b.name, b.name_ar);

  return (
    <Link
      to={`/business/${b.slug}`}
      onClick={onPick}
      className="block"
    >
      <Card className="p-4 transition-colors hover:bg-muted/40">
        <div className="flex items-start gap-3">
          {b.logo_url ? (
            <img src={b.logo_url} alt={name} className="h-12 w-12 rounded-xl object-cover" />
          ) : (
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-accent/15 text-base font-bold text-accent">
              {initials(name)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{name}</span>
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                {b.industry}
              </Badge>
              <span className="ms-auto text-[10px] font-mono text-muted-foreground">
                /{b.slug}
              </span>
            </div>
            {result.reason && (
              <p className="mt-1 text-xs text-muted-foreground">{result.reason}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {result.matchedEquipment.slice(0, 4).map((eq) => (
                <span
                  key={eq.equipment.id}
                  className="rounded-full border border-accent/30 bg-accent/5 px-2 py-0.5 text-[10px] text-accent"
                >
                  {pickLocale(locale, eq.equipment.name, eq.equipment.name_ar)}
                  {eq.equipment.price != null && (
                    <span className="ms-1 opacity-70">
                      +{format(eq.equipment.price, eq.equipment.currency).display}
                    </span>
                  )}
                </span>
              ))}
              {result.matchedEquipment.length > 4 && (
                <span className="text-[10px] text-muted-foreground">
                  +{result.matchedEquipment.length - 4}
                </span>
              )}
            </div>
          </div>
          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      </Card>
    </Link>
  );
}
