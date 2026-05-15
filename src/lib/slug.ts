/**
 * Slug validation + reserved-list enforcement.
 *
 * A "slug" is the URL fragment under /business/<slug> (the customer-facing
 * landing page) and /admin/<slug> (the operator console). Because the same
 * path namespace is shared with platform-level routes, an attacker who can
 * pick an arbitrary slug could:
 *   1. Sit on a path like /business/admin and confuse customers.
 *   2. Shadow real internal routes (`/admin/platform`, `/admin/login`) once
 *      we expand the URL surface.
 *   3. Inject characters that break router matching or look-alike host names.
 *
 * The defenses below run at the form layer; a server-side `CHECK` constraint
 * and `UNIQUE` index on `businesses.slug` are documented in SECURITY.md as
 * the matching backend hardening.
 */

/** Words we never allow a vendor to claim — collide with real routes or
 *  brand-protected terms. Keep lowercased; comparison is case-insensitive. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  // Platform routes (see src/router.tsx)
  "admin",
  "platform",
  "login",
  "logout",
  "signup",
  "signin",
  "payment",
  "payments",
  "callback",
  "checkout",
  "confirmation",
  "privacy",
  "terms",
  "legal",
  "api",
  "www",
  "static",
  "assets",
  "auth",
  "oauth",
  "settings",
  "dashboard",
  "business",
  "businesses",
  "book",
  "booking",
  "bookings",
  // Brand
  "bookit",
  "support",
  "help",
  "contact",
  "about",
  // Generic anti-impersonation
  "official",
  "verified",
  "system",
  "root",
  "null",
  "undefined",
]);

/** Slugs must look like a-z0-9 with dashes; no leading/trailing dash. */
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

export interface SlugValidationResult {
  ok: boolean;
  /** i18n-friendly error code so callers can render the right message. */
  code?:
    | "empty"
    | "tooShort"
    | "tooLong"
    | "invalidChars"
    | "reserved";
}

/** Validate a slug a vendor wants to claim. */
export function validateSlug(raw: string): SlugValidationResult {
  const slug = raw.trim().toLowerCase();
  if (!slug) return { ok: false, code: "empty" };
  if (slug.length < 2) return { ok: false, code: "tooShort" };
  if (slug.length > 40) return { ok: false, code: "tooLong" };
  if (!SLUG_RE.test(slug)) return { ok: false, code: "invalidChars" };
  if (RESERVED_SLUGS.has(slug)) return { ok: false, code: "reserved" };
  return { ok: true };
}

/** Convert a free-form name into a candidate slug. Always passes through
 *  `validateSlug` afterwards — this only normalizes, it does not authorize. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}
