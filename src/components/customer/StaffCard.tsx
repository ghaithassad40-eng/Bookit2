import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn, initials } from "@/lib/utils";
import type { StaffRow } from "@/lib/database.types";

interface Props {
  staff: StaffRow;
  selected?: boolean;
  onSelect?: (staff: StaffRow) => void;
}

export function StaffCard({ staff, selected, onSelect }: Props) {
  return (
    <motion.button
      type="button"
      onClick={() => onSelect?.(staff)}
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
        <CardContent className="flex gap-4 pt-5">
          {staff.profile_photo_url ? (
            <img
              src={staff.profile_photo_url}
              alt={staff.name}
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : (
            <div className="grid h-14 w-14 place-items-center rounded-full bg-accent/15 text-base font-semibold text-accent">
              {initials(staff.name)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="truncate text-base font-semibold">{staff.name}</h4>
              {staff.rating !== null && (
                <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {staff.rating?.toFixed(2)}
                </span>
              )}
            </div>
            {staff.role && <div className="text-sm text-muted-foreground">{staff.role}</div>}
            {staff.specialty && (
              <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                {staff.specialty}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.button>
  );
}
