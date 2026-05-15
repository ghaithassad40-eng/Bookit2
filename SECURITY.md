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
- Enforced client-side in `Settings.tsx` on every slug update. **Backend
  must mirror this** — see *Production checklist*.

### XSS / injection surface
- React escapes all interpolated strings; no `dangerouslySetInnerHTML` is
  used outside of one whitelisted block. Audit before adding more.
- All copy that flows into the page comes either from i18n maps (developer-
  controlled) or from `business_configs.copy_json` (vendor-controlled,
  rendered as text).
- No `window.location = userInput` flows; `useNavigate` accepts only
  developer-defined route templates.

---

## Production checklist (must complete before launch)

> Anything below this line is **not** enforced in the current codebase and
> must be wired into Supabase / your hosting platform before allowing
> non-demo traffic.

### 1. Row-Level Security (RLS)
Enable RLS on every table and ship policies that match the in-app gates.
At minimum:

- `businesses`: vendors can `SELECT` only their own row; platform admins
  can `SELECT/UPDATE` any row. Public `SELECT` is allowed *only* when
  `status = 'approved'`.
- `bookings`: customers can `SELECT/UPDATE/DELETE` only rows where
  `customer_email = auth.email()`; vendors can `SELECT/UPDATE` rows for
  their own `business_id`. **This is the server-side mirror of the
  Confirmation.tsx ownership gate** — without it, the gate is a
  client-only check that an attacker can bypass with a raw API call.
- `business_configs`, `services`, `staff`, `time_slots`: scoped by
  `business_id` ownership.
- `payouts`: vendor read-only on own rows; platform admin full access.

### 2. Server-side slug enforcement
- Add a CHECK constraint: `slug ~ '^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$'`.
- Add a UNIQUE index on `slug`.
- Replicate `RESERVED_SLUGS` from `src/lib/slug.ts` in a Postgres
  function or trigger and reject inserts/updates that hit it.

### 3. Server-side role enforcement
- The `useAuth.ts` rule "demoUser.role is ignored in production" is a
  client check. The backend must additionally refuse any mutation that
  would require `platform_admin` unless the JWT's `app_metadata.role`
  claim is `platform_admin`.
- The Edge Function that approves/rejects businesses must re-check the
  caller's role server-side. Do not rely on the client-side route guard
  alone.

### 4. Booking cancellation / refund authorization
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

Please email security@bookit.app (or open a private GitHub security
advisory) with reproduction steps. Do not file a public issue.
