interface Props {
  /** Minimum height of the splash container. Defaults to a full viewport so
   *  the splash dominates the screen during initial route loads. Pass e.g.
   *  "24rem" when embedding the splash inside an existing layout shell. */
  minHeight?: string;
  /** Optional copy shown beneath the animation (e.g. "Loading your bookings…"). */
  message?: string;
  /** When true, ignores `minHeight` and stretches to fill its parent — useful
   *  inside flex / grid containers that already constrain the area. */
  fullParent?: boolean;
}

/**
 * Brand-animation loading splash. Mirrors the inline boot splash in
 * index.html so the visual transition from "page opening" to "in-app
 * loading" is seamless: same backdrop, same centred video, same gold glow.
 *
 * Use this everywhere we'd otherwise show a Skeleton block for top-level
 * route / data loads. Skeletons are still appropriate for *partial*
 * loading (e.g. a list inside an already-rendered page) — this splash is
 * for whole-page waits.
 */
export function LoadingSplash({
  minHeight = "100vh",
  message,
  fullParent = false,
}: Props) {
  return (
    <div
      className="relative grid place-items-center overflow-hidden bg-[#fafaf7]"
      style={fullParent ? { minHeight: "100%" } : { minHeight }}
    >
      {/* Soft gold radial — matches the boot splash on a clean cream backdrop. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 38%, rgba(201,162,39,0.10) 0%, rgba(201,162,39,0.04) 35%, #fafaf7 70%)",
        }}
      />
      <div className="relative flex flex-col items-center gap-5">
        <video
          src="/bookit-loader.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          className="h-auto w-[min(320px,64vw)] max-h-[60vh] object-contain"
          style={{ filter: "drop-shadow(0 12px 32px rgba(27, 42, 78, 0.18))" }}
        />
        {message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
      </div>
    </div>
  );
}
