import { motion } from "framer-motion";
import { Clock, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ServiceRow } from "@/lib/database.types";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";

interface Props {
  service: ServiceRow;
  selected?: boolean;
  onSelect?: (service: ServiceRow) => void;
}

export function ServiceCard({ service, selected, onSelect }: Props) {
  const { format } = useDisplayCurrency();
  const price = format(service.price, service.currency);
  return (
    <motion.button
      type="button"
      onClick={() => onSelect?.(service)}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      className="text-left focus:outline-none"
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
              <h4 className="text-base font-semibold">{service.name}</h4>
              {service.description && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {service.description}
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
              {service.duration_minutes} min
            </Badge>
            {service.capacity > 1 && (
              <Badge variant="outline" className="gap-1">
                <Users className="h-3 w-3" />
                up to {service.capacity}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.button>
  );
}
