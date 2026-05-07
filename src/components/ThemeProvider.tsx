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
    } else {
      root.style.setProperty("--background", primary);
      root.style.setProperty("--foreground", "240 10% 8%");
      root.style.setProperty("--card", "0 0% 100%");
      root.style.setProperty("--card-foreground", "240 10% 8%");
      root.style.setProperty("--popover", "0 0% 100%");
      root.style.setProperty("--popover-foreground", "240 10% 8%");
      root.style.setProperty("--muted", "240 5% 96%");
      root.style.setProperty("--muted-foreground", "240 5% 40%");
      root.style.setProperty("--border", "240 6% 90%");
      root.style.setProperty("--input", "240 6% 90%");
    }

    root.style.setProperty("--primary", accent);
    root.style.setProperty("--primary-foreground", "0 0% 100%");
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
      // leave styles in place; the next theme will overwrite them
    };
  }, [theme]);

  return <>{children}</>;
}
