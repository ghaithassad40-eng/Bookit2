import { useMemo } from "react";
import { Minus, Plus, Package, Sparkles } from "lucide-react";
import type { EquipmentRow } from "@/lib/database.types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/hooks/useI18n";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { pickLocale } from "@/lib/i18n";
import type { EquipmentCart } from "@/store/bookingStore";

interface Props {
  equipment: EquipmentRow[];
  cart: EquipmentCart;
  onChangeQty: (equipmentId: string, qty: number) => void;
}

/**
 * Cart-style add-on shelf shown after the customer picks a slot. Groups by
 * category, each row has +/- buttons capped at the equipment's
 * `max_per_booking`. Free items render an "Included" badge instead of a
 * price; paid items show the price per unit and the running line total in
 * the customer's display currency.
 */
export function EquipmentShelf({ equipment, cart, onChangeQty }: Props) {
  const { t, locale } = useI18n();
  const { format } = useDisplayCurrency();

  const grouped = useMemo(() => {
    const byCategory = new Map<string, EquipmentRow[]>();
    for (const item of equipment) {
      const k = item.category || "other";
      if (!byCategory.has(k)) byCategory.set(k, []);
      byCategory.get(k)!.push(item);
    }
    // Sort: free-only categories last (so the eye-catching paid stuff is up
    // top); within a category, free items last.
    const categories = Array.from(byCategory.entries());
    categories.sort(([a, av], [b, bv]) => {
      const aHasPaid = av.some((i) => i.price != null);
      const bHasPaid = bv.some((i) => i.price != null);
      if (aHasPaid !== bHasPaid) return aHasPaid ? -1 : 1;
      return a.localeCompare(b);
    });
    for (const [, items] of categories) {
      items.sort((a, b) => {
        if ((a.price == null) !== (b.price == null)) return a.price == null ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
    }
    return categories;
  }, [equipment]);

  if (equipment.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center">
        <Package className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
        <div className="text-sm font-medium">
          {t("equipment.empty")}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {t("equipment.emptyHint")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map(([category, items]) => (
        <section key={category}>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {category}
          </h3>
          <div className="space-y-2">
            {items.map((item) => {
              const qty = cart[item.id] ?? 0;
              const isFree = item.price == null;
              const inCart = qty > 0;
              return (
                <Card
                  key={item.id}
                  className={`flex flex-col gap-3 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                    inCart ? "border-accent/50 bg-accent/5" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {pickLocale(locale, item.name, item.name_ar)}
                      </span>
                      {isFree && (
                        <Badge variant="success" className="gap-1 text-[10px]">
                          <Sparkles className="h-3 w-3" />
                          {t("equipment.included")}
                        </Badge>
                      )}
                    </div>
                    {(item.description || item.description_ar) && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {pickLocale(locale, item.description ?? "", item.description_ar)}
                      </p>
                    )}
                    {!isFree && (
                      <p className="mt-1 text-xs font-medium">
                        {format(item.price!, item.currency).display}
                        <span className="text-muted-foreground"> / {t("equipment.perItem")}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      disabled={qty === 0}
                      onClick={() => onChangeQty(item.id, Math.max(0, qty - 1))}
                      aria-label={t("equipment.decrease")}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="min-w-[2ch] text-center text-sm font-semibold tabular-nums">
                      {qty}
                    </span>
                    <Button
                      variant={inCart ? "default" : "outline"}
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      disabled={qty >= item.max_per_booking}
                      onClick={() => onChangeQty(item.id, Math.min(item.max_per_booking, qty + 1))}
                      aria-label={t("equipment.increase")}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
