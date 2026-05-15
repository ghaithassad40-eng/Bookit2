/**
 * Logo → theme palette extractor.
 *
 * Pure client-side. No backend dependency. Used by the LogoThemeGenerator
 * to suggest a theme_json palette from a vendor's uploaded logo.
 *
 * Algorithm
 * ---------
 * 1. Rasterize the source image into a small canvas (64×64) — fast, plenty
 *    of data for colour profiling, doesn't care about logo resolution.
 * 2. Walk every pixel; drop anything that won't make a useful brand colour:
 *      - alpha < 200 (transparent background)
 *      - luminance > 245 (near-white background / paper)
 *      - luminance < 12  (near-black outline / text)
 *      - saturation < 0.10 (grey neutrals — not brand-distinctive)
 * 3. Quantize remaining pixels to a 4-bit-per-channel RGB cube
 *    (4096 buckets total) and count occurrences. Each bucket also
 *    accumulates the average RGB so the returned colour isn't biased
 *    toward a single pixel.
 * 4. Sort buckets by frequency; return the top N centroids as hex strings.
 *
 * Smart-pick (pickThemeFromPalette)
 * ---------------------------------
 *   primaryColor    — darkest dominant colour (typical "background" feel)
 *   accentColor     — most-saturated colour (typical "CTA / link" feel)
 *   secondaryColor  — second-most-frequent colour, distinct from primary
 *   mode            — 'dark' if the primary luminance < 90; else 'light'
 */

export interface ExtractedColor {
  /** "#RRGGBB" */
  hex: string;
  /** 0..1 normalised pixel share within the considered (non-bg) pixels */
  weight: number;
  hsl: { h: number; s: number; l: number };
}

export interface ThemeSuggestion {
  primaryColor: string;
  accentColor: string;
  secondaryColor: string;
  mode: "light" | "dark";
  /** Full extracted palette, ordered by dominance — UI can show all of
   *  these as swatches so the user understands where the picks came from. */
  palette: ExtractedColor[];
}

const SAMPLE_SIZE = 64;
const MIN_ALPHA = 200;
const MAX_LUMINANCE = 245;
const MIN_LUMINANCE = 12;
const MIN_SATURATION = 0.1;
const QUANT_SHIFT = 4; // 8-bit → 4-bit per channel

/** Load a File or URL into an HTMLImageElement, resolving when decoded. */
export function loadImage(source: File | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error("Failed to load image"));
    if (typeof source === "string") {
      img.src = source;
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        img.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(source);
    }
  });
}

/** Read the resulting data URL from a File without loading into an Image —
 *  useful for storing the logo for preview / business.logo_url. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/** Extract up to `count` brand-distinctive colours from an image. Throws
 *  if no usable colours remain after filtering (pure black/white logo). */
export function extractPalette(
  image: HTMLImageElement,
  count = 5,
): ExtractedColor[] {
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
  } catch {
    // Cross-origin tainted canvas — the caller used a remote URL that
    // doesn't send CORS headers. Surface a clear error.
    throw new Error("Image is cross-origin without CORS — cannot extract colours");
  }

  interface Bucket {
    rSum: number;
    gSum: number;
    bSum: number;
    count: number;
  }
  const buckets = new Map<number, Bucket>();
  let kept = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < MIN_ALPHA) continue;

    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (luminance > MAX_LUMINANCE || luminance < MIN_LUMINANCE) continue;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    if (saturation < MIN_SATURATION) continue;

    const key =
      ((r >> QUANT_SHIFT) << 8) | ((g >> QUANT_SHIFT) << 4) | (b >> QUANT_SHIFT);
    const existing = buckets.get(key);
    if (existing) {
      existing.rSum += r;
      existing.gSum += g;
      existing.bSum += b;
      existing.count++;
    } else {
      buckets.set(key, { rSum: r, gSum: g, bSum: b, count: 1 });
    }
    kept++;
  }

  if (kept === 0) {
    throw new Error("No usable colours found in image");
  }

  const sorted = Array.from(buckets.values())
    .map((b) => {
      const r = Math.round(b.rSum / b.count);
      const g = Math.round(b.gSum / b.count);
      const bl = Math.round(b.bSum / b.count);
      return {
        hex: rgbToHex(r, g, bl),
        weight: b.count / kept,
        hsl: rgbToHsl(r, g, bl),
      } as ExtractedColor;
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, count);

  return sorted;
}

/**
 * Pick a theme_json palette (primary / accent / secondary / mode) from an
 * extracted palette. Heuristics chosen so the result reads like a "designer
 * picked these" rather than "AI dumped colour codes":
 *   - Accent = highest saturation × weight (catches the brand pop colour
 *     even when there's only a little of it — e.g. the gold checkmark in
 *     a navy-dominant logo).
 *   - Primary = darkest dominant colour (looks "structural" — for nav
 *     bars, headers, background gradients).
 *   - Secondary = next most dominant colour distinct from primary +
 *     accent. Falls back to a desaturated tint of primary if everything
 *     extracted is already used.
 *   - Mode = dark if primary luminance < 90, else light.
 */
export function pickThemeFromPalette(palette: ExtractedColor[]): ThemeSuggestion {
  if (palette.length === 0) {
    throw new Error("Empty palette — nothing to pick from");
  }

  // Accent: maximise (saturation × weight). Strongly favours vivid hues
  // over muted ones even when they're a smaller share of pixels.
  const accent = [...palette].sort(
    (a, b) => b.hsl.s * b.weight - a.hsl.s * a.weight,
  )[0];

  // Primary: pick the darkest *non-accent* dominant colour. If only one
  // colour was extracted, primary === accent (the algorithm handles this
  // by darkening the accent for primary).
  const nonAccent = palette.filter((c) => c.hex !== accent.hex);
  const primary =
    nonAccent.length > 0
      ? nonAccent.sort((a, b) => a.hsl.l - b.hsl.l)[0]
      : { ...accent, hex: darken(accent.hex, 0.35) };

  // Secondary: most-dominant colour that isn't primary or accent. Fall
  // back to a desaturated tint of the primary if the palette only has
  // two distinct picks.
  const usedHexes = new Set([primary.hex, accent.hex]);
  const secondaryPick = palette.find((c) => !usedHexes.has(c.hex));
  const secondary = secondaryPick ?? {
    ...primary,
    hex: desaturate(primary.hex, 0.5),
  };

  const primaryLuminance = hexLuminance(primary.hex);
  const mode: "light" | "dark" = primaryLuminance < 90 ? "dark" : "light";

  return {
    primaryColor: primary.hex,
    accentColor: accent.hex,
    secondaryColor: secondary.hex,
    mode,
    palette,
  };
}

// ─── Colour-space helpers ───────────────────────────────────────────────────

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      case bn:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h, s, l };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return { r, g, b };
}

function hexLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function darken(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const k = clamp(1 - amount, 0, 1);
  return rgbToHex(r * k, g * k, b * k);
}

function desaturate(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const avg = (r + g + b) / 3;
  const k = clamp(amount, 0, 1);
  return rgbToHex(r * (1 - k) + avg * k, g * (1 - k) + avg * k, b * (1 - k) + avg * k);
}
