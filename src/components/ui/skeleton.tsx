import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-muted/40",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)]",
        className,
      )}
      {...props}
    />
  );
}
