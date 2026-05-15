// Inline SVG flags for the GCC region (KW, SA, AE, BH, QA, OM).
//
// We deliberately ship vector flags instead of relying on the Unicode regional
// indicator emoji (🇰🇼 etc.) because emoji flag rendering is inconsistent
// across platforms — Windows in particular shows the regional indicator
// letterforms (e.g. "KW") instead of a flag glyph.
//
// Designs are simplified geometric reductions of each national flag — good
// enough to be recognisable in 16–32 px chips while staying dependency-free.

import { cn } from "@/lib/utils";

export type FlagCode = "KW" | "SA" | "AE" | "BH" | "QA" | "OM" | "ALL";

interface Props {
  code: FlagCode;
  /** Tailwind size classes — defaults to a 24×16 swatch. */
  className?: string;
}

export function Flag({ code, className }: Props) {
  const base = "inline-block overflow-hidden rounded-[3px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]";
  const sizing = "h-4 w-6";

  return (
    <span className={cn(base, sizing, className)} aria-hidden>
      <svg viewBox="0 0 30 20" className="h-full w-full" preserveAspectRatio="none">
        {renderFlag(code)}
      </svg>
    </span>
  );
}

function renderFlag(code: FlagCode): React.ReactNode {
  switch (code) {
    case "KW":
      // Kuwait: green / white / red horizontal stripes with black hoist trapezoid.
      return (
        <>
          <rect width="30" height="20" fill="#fff" />
          <rect width="30" height="6.67" fill="#007a3d" />
          <rect y="13.33" width="30" height="6.67" fill="#ce1126" />
          <polygon points="0,0 8,6.67 8,13.33 0,20" fill="#000" />
        </>
      );
    case "SA":
      // Saudi Arabia: solid green with a thin white emblem band (simplified
      // stand-in for the shahada + sword).
      return (
        <>
          <rect width="30" height="20" fill="#006c35" />
          <rect x="6" y="7.5" width="18" height="1.6" rx="0.4" fill="#fff" />
          <rect x="6" y="11" width="18" height="1.2" rx="0.4" fill="#fff" />
        </>
      );
    case "AE":
      // UAE: red vertical hoist + green / white / black horizontal stripes.
      return (
        <>
          <rect width="30" height="20" fill="#fff" />
          <rect width="30" height="6.67" fill="#00732f" />
          <rect y="13.33" width="30" height="6.67" fill="#000" />
          <rect width="7.5" height="20" fill="#ff0000" />
        </>
      );
    case "BH":
      // Bahrain: red field with white serrated (5-point) hoist strip.
      return (
        <>
          <rect width="30" height="20" fill="#ce1126" />
          <polygon
            points="0,0 9,0 12,2 9,4 12,6 9,8 12,10 9,12 12,14 9,16 12,18 9,20 0,20"
            fill="#fff"
          />
        </>
      );
    case "QA":
      // Qatar: maroon field with white serrated (9-point) hoist strip.
      return (
        <>
          <rect width="30" height="20" fill="#8a1538" />
          <polygon
            points="0,0 9,0 12,1.11 9,2.22 12,3.33 9,4.44 12,5.56 9,6.67 12,7.78 9,8.89 12,10 9,11.11 12,12.22 9,13.33 12,14.44 9,15.56 12,16.67 9,17.78 12,18.89 9,20 0,20"
            fill="#fff"
          />
        </>
      );
    case "OM":
      // Oman: red vertical hoist + white / red / green horizontal stripes.
      return (
        <>
          <rect width="30" height="6.67" fill="#fff" />
          <rect y="6.67" width="30" height="6.67" fill="#db161b" />
          <rect y="13.33" width="30" height="6.67" fill="#008000" />
          <rect width="9" height="20" fill="#db161b" />
        </>
      );
    case "ALL":
      // Globe-style accent swatch used for the "all GCC" option.
      return (
        <>
          <rect width="30" height="20" fill="#0ea5e9" />
          <circle cx="15" cy="10" r="6" fill="none" stroke="#fff" strokeWidth="1.2" />
          <path
            d="M9 10 H21 M15 4 Q19 10 15 16 Q11 10 15 4"
            stroke="#fff"
            strokeWidth="1.2"
            fill="none"
          />
        </>
      );
  }
}
