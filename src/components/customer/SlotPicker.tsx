import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { cn, formatDate, formatTime, groupBy } from "@/lib/utils";
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
  const grouped = useMemo(() => groupBy(slots, (s) => dayKey(s.start_time)), [slots]);
  const days = useMemo(() => Object.keys(grouped).sort(), [grouped]);
  const [activeDay, setActiveDay] = useState(days[0] ?? "");

  if (slots.length === 0) {
    return (
      <EmptyState
        title="No upcoming slots"
        description="Try a different service or staff member."
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
                  {date.toLocaleDateString(undefined, { weekday: "short" })}
                </span>
                <span className="mt-0.5 text-base font-semibold text-foreground">
                  {date.getDate()}
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
          {formatDate(safeDay + "T00:00:00")}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {daySlots.map((slot) => {
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
                <div className="font-medium">{formatTime(slot.start_time)}</div>
                <div className="text-[10px] text-muted-foreground">
                  {slot.capacity - slot.booked_count} left
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
