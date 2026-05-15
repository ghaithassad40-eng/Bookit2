import { motion } from "framer-motion";
import { Clock, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ServiceRow } from "@/lib/database.types";
import { useMemo } from "react";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { useI18n } from "@/hooks/useI18n";
import { useRegion } from "@/hooks/useRegion";
import { pickLocale } from "@/lib/i18n";

interface Props {
  service: ServiceRow;
  selected?: boolean;
  onSelect?: (service: ServiceRow) => void;
}

export function ServiceCard({ service, selected, onSelect }: Props) {
  const { format } = useDisplayCurrency();
  const { locale, t, intl } = useI18n();
  const { country } = useRegion();
  const price = format(service.price, service.currency);
  const name = pickLocale(locale, service.name, service.name_ar);
  const description = pickLocale(locale, service.description, service.description_ar);
  const numberFmt = useMemo(
    () => new Intl.NumberFormat(intl(country && country !== "ALL" ? country : null)),
    [intl, country],
  );
  return (
    <motion.button
      type="button"
      onClick={() => onSelect?.(service)}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      className="text-start focus:outline-none"
    >
      <Card
        className={cn(
          "h-full transition-all hover:border-accent/40",
          selected && "border-accent shadow-lg shadow-accent/10",
        )}
      >
        <div
          className="h-1 rounded-t-2xl"
          style={{ backgroundColor: service.color ?? "#3B82F6" }}
        />
        <CardContent className="space-y-3 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-base font-semibold">{name}</h4>
              {description && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            <div className="text-right">
              <div className="text-base font-semibold">{price.display}</div>
              {price.converted && (
                <div className="mt-0.5 text-[10px] font-mono text-muted-foreground">
                  ≈ {price.native}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              {numberFmt.format(service.duration_minutes)} {t("service.minutes")}
            </Badge>
            {service.capacity > 1 && (
              <Badge variant="outline" className="gap-1">
                <Users className="h-3 w-3" />
                {t("service.upTo")} {numberFmt.format(service.capacity)}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.button>
  );
}
