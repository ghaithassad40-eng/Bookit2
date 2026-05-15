import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { cn, groupBy } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";
import { useRegion } from "@/hooks/useRegion";
import type { TimeSlotRow } from "@/lib/database.types";

interface Props {
  slots: TimeSlotRow[];
  selectedSlotId?: string | null;
  onSelect: (slot: TimeSlotRow) => void;
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
}

export function SlotPicker({ slots, selectedSlotId, onSelect }: Props) {
  const { t, intl } = useI18n();
  const { country } = useRegion();
  const tag = intl(country && country !== "ALL" ? country : null);

  const dayHeadingFmt = useMemo(
    () => new Intl.DateTimeFormat(tag, { weekday: "long", day: "numeric", month: "long" }),
    [tag],
  );
  const weekdayFmt = useMemo(
    () => new Intl.DateTimeFormat(tag, { weekday: "short" }),
    [tag],
  );
  const dayNumFmt = useMemo(
    () => new Intl.NumberFormat(tag),
    [tag],
  );
  const timeFmt = useMemo(
    () => new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit" }),
    [tag],
  );

  // Dedupe duplicate slots at the same start_time: if any slot at that time
  // is open, drop the fully-booked duplicates. Same-time open slots are kept
  // (they're separate inventory units). Closes QA bug #3 from the tour.
  const dedupedSlots = useMemo(() => {
    const byTime = new Map<string, TimeSlotRow[]>();
    for (const s of slots) {
      const key = s.start_time;
      const arr = byTime.get(key) ?? [];
      arr.push(s);
      byTime.set(key, arr);
    }
    const out: TimeSlotRow[] = [];
    for (const list of byTime.values()) {
      const hasOpen = list.some((s) => s.booked_count < s.capacity && s.status === "open");
      for (const s of list) {
        const isFull = s.booked_count >= s.capacity || s.status !== "open";
        if (hasOpen && isFull) continue; // hide the redundant full row
        out.push(s);
      }
    }
    return out;
  }, [slots]);

  const grouped = useMemo(() => groupBy(dedupedSlots, (s) => dayKey(s.start_time)), [dedupedSlots]);
  const days = useMemo(() => Object.keys(grouped).sort(), [grouped]);
  const [activeDay, setActiveDay] = useState(days[0] ?? "");

  if (dedupedSlots.length === 0) {
    return (
      <EmptyState
        title={t("slot.empty.title")}
        description={t("slot.empty.body")}
      />
    );
  }

  const safeDay = days.includes(activeDay) ? activeDay : days[0];
  const daySlots = grouped[safeDay] ?? [];
  const dayIndex = days.indexOf(safeDay);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Button
          variant="ghost"
          size="icon"
          disabled={dayIndex <= 0}
          onClick={() => setActiveDay(days[dayIndex - 1])}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-1 gap-2 overflow-x-auto">
          {days.map((d) => {
            const isActive = d === safeDay;
            const date = new Date(d + "T00:00:00");
            return (
              <button
                key={d}
                onClick={() => setActiveDay(d)}
                className={cn(
                  "flex shrink-0 flex-col items-center rounded-xl border px-3 py-2 text-xs transition-colors",
                  isActive
                    ? "border-accent bg-accent/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-accent/40",
                )}
              >
                <span className="text-[10px] uppercase tracking-wide">
                  {weekdayFmt.format(date)}
                </span>
                <span className="mt-0.5 text-base font-semibold text-foreground">
                  {dayNumFmt.format(date.getDate())}
                </span>
              </button>
            );
          })}
        </div>
        <Button
          variant="ghost"
          size="icon"
          disabled={dayIndex >= days.length - 1}
          onClick={() => setActiveDay(days[dayIndex + 1])}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card/40 p-4">
        <div className="mb-3 text-sm font-medium text-muted-foreground">
          {dayHeadingFmt.format(new Date(safeDay + "T00:00:00"))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {daySlots.map((slot) => {
            const remaining = slot.capacity - slot.booked_count;
            const disabled =
              slot.status !== "open" ||
              slot.booked_count >= slot.capacity ||
              new Date(slot.start_time).getTime() < Date.now();
            const selected = slot.id === selectedSlotId;
            return (
              <motion.button
                key={slot.id}
                whileTap={{ scale: 0.97 }}
                onClick={() => !disabled && onSelect(slot)}
                disabled={disabled}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm transition-colors",
                  disabled
                    ? "cursor-not-allowed border-border/40 text-muted-foreground/60 line-through"
                    : selected
                    ? "border-accent bg-accent/10 text-foreground"
                    : "border-border hover:border-accent/40",
                )}
              >
                <div className="font-medium">{timeFmt.format(new Date(slot.start_time))}</div>
                <div className="text-[10px] text-muted-foreground">
                  {dayNumFmt.format(remaining)} {t("slot.left")}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
