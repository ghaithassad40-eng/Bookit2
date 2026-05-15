import { useEffect } from "react";
import type { ThemeJson } from "@/lib/database.types";
import { hexToHsl } from "@/lib/utils";

interface Props {
  theme: ThemeJson;
  children: React.ReactNode;
}

const RADIUS_MAP: Record<ThemeJson["borderRadius"], string> = {
  sm: "0.375rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  "2xl": "1.25rem",
  "3xl": "1.75rem",
};

/**
 * Reads a `theme_json` from Supabase and applies it as CSS custom
 * properties on :root. Switches dark/light mode and font family.
 */
export function ThemeProvider({ theme, children }: Props) {
  useEffect(() => {
    const root = document.documentElement;

    // mode
    root.classList.toggle("dark", theme.mode === "dark");

    // colors → tailwind tokens
    const accent = hexToHsl(theme.accentColor);
    const secondary = hexToHsl(theme.secondaryColor);
    const primary = hexToHsl(theme.primaryColor);

    // Map the vendor's theme_json into shadcn semantic tokens.
    //
    // Bug we're fixing here: this used to apply `primaryColor` to
    // `--background` in light mode too. Vendors with a dark navy
    // primaryColor (Meridian: #0f172a, gym/football defaults: #0a0a0f)
    // ended up with a near-black page background under "light" mode,
    // then near-black text on top → invisible copy. The screenshot
    // that surfaced this came in on May 15 2026.
    //
    // New mapping:
    //   light mode → background = white, --primary = primaryColor
    //                (brand colour pops as CTA on white).
    //   dark mode  → background = primaryColor (intentional dark
    //                brand backdrop), --primary = accentColor
    //                (highlight pops on the dark backdrop).
    if (theme.mode === "dark") {
      root.style.setProperty("--background", primary);
      root.style.setProperty("--foreground", "210 20% 98%");
      root.style.setProperty("--card", "240 10% 6%");
      root.style.setProperty("--card-foreground", "210 20% 98%");
      root.style.setProperty("--popover", "240 10% 6%");
      root.style.setProperty("--popover-foreground", "210 20% 98%");
      root.style.setProperty("--muted", "240 5% 12%");
      root.style.setProperty("--muted-foreground", "240 5% 65%");
      root.style.setProperty("--border", "240 6% 18%");
      root.style.setProperty("--input", "240 6% 18%");
      // On dark, accent is the loud CTA colour; primary follows so
      // <Button> defaults still pop.
      root.style.setProperty("--primary", accent);
      root.style.setProperty("--primary-foreground", "0 0% 100%");
    } else {
      // Light mode: clean white backdrop, brand colours as accents.
      root.style.setProperty("--background", "0 0% 100%");
      root.style.setProperty("--foreground", "220 49% 14%");
      root.style.setProperty("--card", "0 0% 100%");
      root.style.setProperty("--card-foreground", "220 49% 14%");
      root.style.setProperty("--popover", "0 0% 100%");
      root.style.setProperty("--popover-foreground", "220 49% 14%");
      root.style.setProperty("--muted", "220 14% 96%");
      root.style.setProperty("--muted-foreground", "220 9% 40%");
      root.style.setProperty("--border", "220 14% 90%");
      root.style.setProperty("--input", "220 14% 90%");
      // primaryColor is the brand's main mark — drive CTAs with it
      // so a navy-branded vendor gets navy buttons, a teal vendor
      // gets teal buttons, etc.
      root.style.setProperty("--primary", primary);
      root.style.setProperty("--primary-foreground", "0 0% 100%");
    }

    root.style.setProperty("--accent", accent);
    root.style.setProperty("--accent-foreground", "0 0% 100%");
    root.style.setProperty("--secondary", secondary);
    root.style.setProperty("--secondary-foreground", "0 0% 100%");
    root.style.setProperty("--destructive", "0 84% 60%");
    root.style.setProperty("--destructive-foreground", "0 0% 100%");
    root.style.setProperty("--ring", accent);
    root.style.setProperty("--radius", RADIUS_MAP[theme.borderRadius] ?? "1rem");
    root.style.setProperty("--font-sans", `"${theme.fontFamily}"`);

    return () => {
      // Restore the app palette on unmount so the vendor's brand
      // doesn't leak onto pages outside their workspace (e.g. when
      // a customer navigates from a vendor landing back to /home).
      // Removing the inline properties lets the index.css defaults
      // take over again.
      const props = [
        "--background",
        "--foreground",
        "--card",
        "--card-foreground",
        "--popover",
        "--popover-foreground",
        "--muted",
        "--muted-foreground",
        "--border",
        "--input",
        "--primary",
        "--primary-foreground",
        "--accent",
        "--accent-foreground",
        "--secondary",
        "--secondary-foreground",
        "--destructive",
        "--destructive-foreground",
        "--ring",
        "--radius",
        "--font-sans",
      ];
      for (const p of props) root.style.removeProperty(p);
      root.classList.remove("dark");
    };
  }, [theme]);

  return <>{children}</>;
}
