import { useEffect } from "react";

/**
 * Host split — which "side" of Bookit is this tab on?
 *
 * Bookit ships as one React bundle but is served from two URLs:
 *
 *   Customer + vendor site   bk-it.ai          (dev: localhost:5173)
 *   Platform ops console     admin.bk-it.ai    (dev: localhost:5174)
 *
 * The same router runs on both, but the *exported route tree* differs by
 * host (see src/router.tsx). The two surfaces share auth + i18n + theme,
 * yet a vendor browsing bk-it.ai can never accidentally land on the
 * platform console UI, and a marketplace operator on admin.bk-it.ai
 * never sees customer-facing pages.
 *
 * Detection order:
 *   1. Build-time override   `VITE_HOST_MODE=admin`  (used by dev:admin)
 *   2. URL ?_host=admin|main override               (for QA / Cypress)
 *   3. Subdomain prefix      admin.*               → admin
 *   4. Dev port              :5174                 → admin
 *   5. Default                                      → main
 */
export type HostMode = "main" | "admin";

const ADMIN_PORT = "5174";
const MAIN_PORT = "5173";

export function getHostMode(): HostMode {
  // SSR / pre-React fallback — boot-time renders treat as main.
  if (typeof window === "undefined") return "main";

  // 1. Build-time mode override (dev:admin script sets this)
  if ((import.meta.env.VITE_HOST_MODE as string | undefined) === "admin") {
    return "admin";
  }

  // 2. URL query override — useful for screenshot tests and local QA.
  //    Persists across navigation as long as the param sticks; otherwise
  //    the natural host detection takes over.
  try {
    const params = new URLSearchParams(window.location.search);
    const override = params.get("_host");
    if (override === "admin" || override === "main") return override;
  } catch {
    /* malformed URL — ignore and fall through */
  }

  const host = window.location.host;
  // 3. Production subdomain
  if (host.startsWith("admin.")) return "admin";
  // 4. Dev port
  if (host.endsWith(`:${ADMIN_PORT}`)) return "admin";

  return "main";
}

/** Absolute origin of the main (customer + vendor) site for cross-host
 *  links. Always returns a string like "https://bk-it.ai" or
 *  "http://localhost:5173". Safe to use in `window.location.assign(...)`. */
export function mainOrigin(): string {
  if (typeof window === "undefined") return "";
  const { protocol, hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `${protocol}//${hostname}:${MAIN_PORT}`;
  }
  // Strip any `admin.` or `www.` prefix from the apex.
  const apex = hostname.replace(/^admin\./, "").replace(/^www\./, "");
  return `${protocol}//${apex}`;
}

/** Absolute origin of the platform admin console. */
export function adminOrigin(): string {
  if (typeof window === "undefined") return "";
  const { protocol, hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `${protocol}//${hostname}:${ADMIN_PORT}`;
  }
  const apex = hostname.replace(/^admin\./, "").replace(/^www\./, "");
  return `${protocol}//admin.${apex}`;
}

/** Build a full cross-host URL. Use when you need to send a user from
 *  the main site to the admin console (or vice-versa) and React Router's
 *  `<Navigate />` won't help because it can't leave the current origin. */
export function buildCrossHostUrl(target: HostMode, path: string): string {
  const origin = target === "admin" ? adminOrigin() : mainOrigin();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${normalized}`;
}

/** Imperatively send the browser to another host. Use in event handlers
 *  / effects — there's no graceful client-side navigation across origins. */
export function goCrossHost(target: HostMode, path: string): void {
  if (typeof window === "undefined") return;
  window.location.assign(buildCrossHostUrl(target, path));
}

/**
 * Renderable redirect — drop this in place of a `<Navigate>` when the
 * destination is on the *other* host. Effectively a full page load to
 * the target URL, which is what we want for cross-origin moves
 * (cookies + CSP rescope on host boundaries).
 */
export function ExternalRedirect({
  to,
  target,
}: {
  to: string;
  target: HostMode;
}): null {
  useEffect(() => {
    goCrossHost(target, to);
  }, [to, target]);
  return null;
}
