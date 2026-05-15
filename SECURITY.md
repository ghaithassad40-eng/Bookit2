# Security

Bookit is currently a demo / pre-production MVP. This document captures the
threat model the codebase assumes, the in-app defenses that have already
landed, and the **server-side hardening that must be completed before going
live with real money or real customer data**.

If you are reviewing this for go-live, read the *Production checklist*
section at the bottom — that's the gate.

---

## Threat model (in scope)

| Actor | Capability | Goal |
|---|---|---|
| Anonymous web visitor | Can craft any URL, inspect/edit localStorage, replay requests | View other customers' bookings, trigger refunds, view internal admin |
| Customer (signed in) | Knows their own booking reference | Pivot to other customers' bookings via reference enumeration |
| Vendor (signed in) | Owns one business | Read or mutate another vendor's data; impersonate the platform admin |
| Platform admin (signed in) | Marketplace operator | Out of scope — assumed trusted |
| Network attacker | MITM on customer device | Out of scope at the app layer (TLS / HSTS at the CDN) |

Out of scope: backend operator compromise, supply-chain compromise of npm
deps, browser-extension malware.

---

## Defenses in the current codebase

### Authentication
- Operator auth uses Supabase (`@supabase/supabase-js`). RBAC is read from
  `app_metadata.role` which is **server-controlled** — clients can edit
  `user_metadata` but never `app_metadata`.
- Customer auth is a separate, lightweight flow (`src/lib/customerAuth.ts`).
  In demo mode it stores credentials in localStorage; in production it must
  switch to Supabase customer accounts (see *Production checklist*).
- Demo mode (`src/lib/demoAuth.ts`) keeps a `DemoUser` record in
  localStorage. **Role resolution explicitly ignores `demoUser.role` in
  production builds** (`src/hooks/useAuth.ts`) — a malicious user editing
  localStorage in prod cannot grant themselves `platform_admin`. The
  platform-admin demo CTA is also hidden in prod (`src/pages/admin/Login.tsx`).

### Host split
- Bookit serves two surfaces from two different hosts:
  - **`bk-it.ai`** — customer site + vendor admin workspaces
  - **`admin.bk-it.ai`** — platform operations console (you, internally)
- The same React bundle runs on both. `src/lib/host.ts` resolves which
  host the current tab is on (via subdomain in prod, port in dev — 5173
  / 5174), and `src/router.tsx` exposes a different route tree per host.
  Vendor + customer routes 404 on the admin host; the platform console
  route 404s on the main host. Cross-host hits bounce via full page
  navigation (origin boundary respected).
- This is **client-side routing isolation**, not a security boundary by
  itself — but it sets up the production hardening:
  - Per-host cookies (admin console cookies scoped to `admin.bk-it.ai`)
  - Stricter CSP / CORS on the admin host
  - Optional IP allow-list / VPN gate on `admin.bk-it.ai` (Cloudflare
    Access or similar) before launch.

### Authorization
- `PlatformAdminLayout` rejects everyone except `isPlatformAdmin`.
- `AdminLayout` scopes each vendor to their `/admin/:slug` workspace.
- `Confirmation.tsx` enforces **owner-only access**: if a booking carries a
  `customer_email`, the signed-in customer's email must match (case-
  insensitive) before the receipt — including name/email/phone — is
  rendered, and before the cancel/refund button is shown. The `handleCancel`
  handler also re-checks ownership so a race or DOM tamper can't trigger a
  refund. Legacy bookings without an email pass through (demo-only).

### Booking references
- 8-char Crockford-style alphabet (32 symbols), generated via
  `crypto.getRandomValues` with rejection-bias-free masking. 40 bits of
  entropy makes enumeration effectively infeasible.
- The reference is **not** the security boundary — the ownership gate is.
  Strong refs are defense-in-depth only.

### Slug squatting
- `src/lib/slug.ts` rejects reserved words (`admin`, `platform`, `login`,
  `payment`, `privacy`, `terms`, …) and validates `^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$`.
- Enforced client-side in `Settings.tsx` on every slug update.
- Mirrored in `supabase/migrations/0011_production_validation.sql` via the
  `reject_reserved_slug` trigger — direct table writes hit the same
  RESERVED list + regex.

### XSS / injection surface
- React escapes all interpolated strings; no `dangerouslySetInnerHTML` is
  used outside of one whitelisted block. Audit before adding more.
- All copy that flows into the page comes either from i18n maps (developer-
  controlled) or from `business_configs.copy_json` (vendor-controlled,
  rendered as text).
- No `window.location = userInput` flows; `useNavigate` accepts only
  developer-defined route templates.

---

## Production hardening status

### ✅ Done (migrations 0009 / 0010 / 0011 — apply via `supabase db push`)

| Item | Where |
|---|---|
| RLS enabled + scoped on every table | `0010_production_rls.sql` |
| `businesses` public read = `status='approved'` only | `0010` |
| `bookings` customer-scoped read by `auth.email()` | `0010` |
| `bookings` customer cancel restricted to `status→cancelled` | `0010` |
| `equipment` / `booking_equipment` / `reviews` RLS | `0010` |
| `customer_payment_methods` self-only (no platform-admin override) | `0010` |
| `audit_log` read-by-role, no direct insert | `0010` |
| `user_roles` table + `is_platform_admin()` helper | `0009` + `0010` |
| Reserved-slug rejection at the DB | `0011` trigger |
| Slug format regex enforced at the DB | `0011` trigger |
| `create_booking_atomic` with `SELECT FOR UPDATE` slot lock | `0011` RPC |
| `create_booking_atomic` rejects mismatched `slot.business_id` | `0011` |
| `cancel_booking_atomic` with ownership re-check | `0011` RPC |
| Slot `booked_count` decremented on cancel | `0011` |
| Audit log triggers on `businesses.status`, `bookings.status`, `payouts` | `0011` |

### ⚠️ Required for go-live (NOT yet automated — see DEPLOYMENT.md)

### 1. Server-side role enforcement at the application boundary
- Edge Functions that mutate sensitive state must verify the JWT's
  `is_platform_admin()` server-side, not just check role in the client.
  The DB-level `is_platform_admin()` helper already exists; Edge
  Functions need to call it via the user's JWT before performing
  privileged work.

### 2. Booking cancellation / refund authorization
- The refund Edge Function must independently verify that the calling
  customer's email matches the booking's `customer_email` before
  triggering the MyFatoorah refund. The Confirmation.tsx check is the
  UX layer; the Edge Function is the security boundary.

### 5. Slot reservation race
- When two customers attempt the same `slot_id` simultaneously, the
  current code path can double-book. Use `SELECT … FOR UPDATE` inside a
  transaction, or add a UNIQUE constraint on
  `(business_id, slot_id, status IN ('confirmed','pending'))`.

### 6. Customer password storage
- Demo mode hashes are SHA-256-of-password in localStorage. Production
  must migrate to Supabase Auth (or another vetted provider) so passwords
  are bcrypt/argon2-hashed server-side and never stored client-side.

### 7. Rate limiting
- Booking creation, cancel, login (vendor + customer), and password reset
  endpoints must be rate-limited at the edge. Suggested: 10/min per IP
  per endpoint, with a stricter budget on cancel/refund.

### 8. Audit log
- Every status change on `businesses.status`, every cancel, and every
  refund must write to an append-only `audit_log` table including actor
  user_id, ip, timestamp, before/after.

### 9. HTTP hardening
- HSTS, `Content-Security-Policy` (script-src 'self' + the
  MyFatoorah/Supabase origins), `Referrer-Policy: no-referrer`,
  `Permissions-Policy: geolocation=(self)`, `X-Frame-Options: DENY`.
- Cookies set by Supabase must be `Secure; HttpOnly; SameSite=Lax`.

### 10. Secret hygiene
- `VITE_*` env vars are shipped to the browser bundle — anything
  truly secret (MyFatoorah token, service-role keys) must stay
  server-side only. Audit `import.meta.env` references before each
  release; the only allowed public ones are anon key + project URL.

---

## Reporting a vulnerability

Please email security@bk-it.ai (or open a private GitHub security
advisory) with reproduction steps. Do not file a public issue.
