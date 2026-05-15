# Deploying Bookit to production

This runbook takes you from a fresh Supabase project to a live
`bk-it.ai` deployment. **Do every step in order** — later steps
assume earlier ones already ran. Visit `/health` on your domain after
each big step to verify it landed.

> **Hard rule.** Don't take real customer money or PII until **every
> check on `/health` is green AND every box in the security section
> at the bottom is ticked**.

---

## 0. Before you start

You need accounts at:

- [ ] **Supabase** — project created in the GCC region (Frankfurt is
      closest if Bahrain isn't available). Note the Project Ref, the
      project URL, the anon key, and the service-role key.
- [ ] **Vercel** — GitHub repo connected to a project.
- [ ] **OpenRouter** — API key with at least $5 credit (used by the
      AI brand-generator + equipment-search Edge Functions).
- [ ] **MyFatoorah** — production credentials (NOT the test ones we
      use locally). Requires KYC — start this early, can take 1–2
      weeks.
- [ ] **Domain `bk-it.ai`** — registered, you control DNS.
- [ ] **Supabase CLI** installed locally (`brew install supabase/tap/supabase`).

Have them in front of you before you start. The runbook assumes
they're already created.

---

## 1. Supabase: apply migrations

```bash
# From the repo root
supabase link --project-ref <your-project-ref>
supabase db push   # applies every migration in supabase/migrations/ in order
```

Expected output: 11 migrations applied (0001 → 0011). If any fail,
**don't proceed** — Supabase migrations are forward-only.

Verify schema landed:

```sql
-- in the Supabase SQL editor
select tablename from pg_tables
  where schemaname = 'public'
  order by tablename;
```

You should see at minimum: `audit_log`, `booking_equipment`,
`bookings`, `business_configs`, `businesses`, `customer_payment_methods`,
`equipment`, `ledger_entries`, `payment_events`, `payouts`, `promo_codes`,
`reviews`, `services`, `staff`, `time_slots`, `user_roles`,
`waitlist_entries`.

---

## 2. Supabase: seed minimum approved data (optional)

The migrations don't ship demo data — production should start empty
or with your own real seed. If you want a public marketing site
that shows a few demo businesses while you onboard vendors, run
`supabase/migrations/0003_seed_data.sql` against your project.

If you go this route, **mark seed businesses as `status = 'pending'`**
so they don't appear publicly until you approve them in the platform
console.

---

## 3. Supabase: bootstrap the first platform admin

The RLS policies need at least one row in `user_roles` with
`role = 'platform_admin'` for the platform console to work. The
policy can't insert that row from a JWT (chicken/egg), so you do
it once via the service-role.

1. Create your operator user in Supabase Auth (Dashboard → Authentication → Users → Add user).
2. Copy the user's UUID.
3. In the SQL editor:

```sql
insert into public.user_roles (user_id, role)
values ('<your-user-uuid>', 'platform_admin');
```

From here on, that operator can grant `platform_admin` to other
users via the console (or via the same SQL pattern).

---

## 4. Vercel: configure env vars

Settings → Environment Variables → **Production** scope only:

| Variable | Value | Used by |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` | All hooks |
| `VITE_SUPABASE_ANON_KEY` | from Supabase → Project Settings → API | All hooks |
| `VITE_MYFATOORAH_ENABLED` | `true` | Payment flow |

**Do NOT set `MYFATOORAH_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` here**
— those live on Supabase (step 5) and never reach the browser bundle.

Trigger a redeploy after saving.

---

## 5. Deploy Edge Functions

```bash
supabase functions deploy \
  create-booking \
  charge-payment \
  release-payout \
  myfatoorah-initiate \
  myfatoorah-callback \
  calendar-feed \
  ai-brand-generator \
  ai-equipment-search \
  ai-concierge
```

Then set the secrets each function needs:

```bash
supabase secrets set \
  OPENROUTER_API_KEY=<your-openrouter-key> \
  MYFATOORAH_API_KEY=<your-myfatoorah-PRODUCTION-key> \
  MYFATOORAH_BASE_URL=https://api.myfatoorah.com \
  MYFATOORAH_RETURN_BASE=https://bk-it.ai
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by
Supabase — you don't need to set them.

---

## 6. DNS: point bk-it.ai at Vercel

In Vercel → Settings → Domains:

1. Add `bk-it.ai` and `admin.bk-it.ai` (same project, two domain
   bindings — the runtime host detector picks the right route tree).
2. Vercel shows you DNS records. At your registrar:
   - `bk-it.ai` → A record to `76.76.21.21`, or change nameservers to Vercel's.
   - `www.bk-it.ai` → CNAME to `cname.vercel-dns.com`.
   - `admin.bk-it.ai` → CNAME to `cname.vercel-dns.com`.
3. Wait for propagation (5min – 1h). Vercel auto-issues Let's Encrypt
   certs for both domains.

---

## 7. Vercel: rewrite the calendar feed URL

The vendor calendar sync URL the app builds is
`https://bk-it.ai/api/calendar/<slug>.ics`. That path needs to hit the
`calendar-feed` Edge Function. Add a rewrite to `vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/api/calendar/:slug.ics",
      "destination": "https://<your-project-ref>.functions.supabase.co/calendar-feed?slug=:slug"
    },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

The order matters — put the API rewrite **before** the SPA fallback.

---

## 8. Smoke test via `/health`

1. Open `https://bk-it.ai/health`.
2. Every row should be ✅ or skipped intentionally.
3. If something is ❌ red, click "How to fix" — it links straight to
   the relevant migration file or section above.

Common failures and what they mean:

| Failure | Likely cause |
|---|---|
| `Supabase REST reachable` red | env vars not set on Vercel, or wrong project URL |
| `Public read` returns 0 | no `status='approved'` businesses seeded yet (expected on a fresh prod) |
| `RLS — customer isolation` returned rows | migration 0010 didn't run — re-run `supabase db push` |
| `user_roles table reachable` missing | migration 0009 didn't run |
| `Edge Function: calendar-feed` non-404 | function not deployed, or wrong path |

---

## 9. End-to-end test with real data

In **incognito**, on the live `bk-it.ai`:

1. Sign up as a customer (`/admin/login` → "Create account").
2. As that customer, book a service at one of your seed businesses.
3. Verify the receipt loads at `/business/.../confirmation?ref=...`.
4. Open a second incognito tab — paste the same URL. **It should
   show "This booking isn't yours"** (RLS gate working).
5. As the customer, cancel the booking from the Confirmation page.
6. Verify the slot's `booked_count` decremented (Supabase Dashboard
   → Table Editor → time_slots).
7. Run `/health` once more — everything still green.

If any of those fail, **do not let real vendors onboard yet**.

---

## 10. Pre-launch security checklist

This is the gate. Don't go live until every box is ticked.

- [ ] **RLS verified in `/health`** — customer isolation row is green.
- [ ] **Platform admin bootstrapped** — `user_roles` has at least one row.
- [ ] **MyFatoorah on production credentials** — not test/staging.
- [ ] **Webhook URL registered with MyFatoorah** — they need to know where
      to POST payment confirmations.
- [ ] **DNS + SSL** — `bk-it.ai` and `admin.bk-it.ai` both serve HTTPS
      with no cert warnings.
- [ ] **HSTS header set** at Vercel (Settings → Headers → add `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`).
- [ ] **Privacy policy + Terms reviewed** by a GCC-licensed lawyer for
      PDPL compliance (KSA + UAE + KW all have their own data laws).
- [ ] **Backup tested** — pg_dump from the Supabase Dashboard works.
- [ ] **First real vendor onboarded** through the actual signup flow
      (not the demo CTA), approved via the platform console, can log
      in, can create services, can take a real booking on a real card.
- [ ] **Refund tested end-to-end** with MyFatoorah production —
      money actually moves back.
- [ ] **Audit log entries** appear when you change a business's status
      and when a booking gets cancelled (`select * from audit_log
      order by created_at desc limit 20;`).
- [ ] **Vat number capture UI exists** for SA vendors (ZATCA Phase 2
      compliance) — **NOT shipped yet**, must build before SA launch.
- [ ] **Rate limiting** on `/admin/login` and `/admin/signup` —
      Vercel WAF rule or Cloudflare in front.
- [ ] **Sentry / equivalent error monitoring** wired and verified.
- [ ] **Postmark / Resend** sender domain DKIM + SPF verified;
      transactional emails actually arrive in customer inboxes.

---

## Troubleshooting

### `/health` says "Public read returned 0 approved businesses"

Either:
- You haven't seeded any businesses yet (expected on fresh prod), or
- All your businesses are in `status = 'pending'` waiting for platform
  admin approval.

Open the platform console at `admin.bk-it.ai/admin/platform` and
approve one to verify the flow works.

### Booking creation fails with `permission denied for table bookings`

The React app is doing a direct `INSERT` instead of calling the
`create_booking_atomic` RPC. Check `src/hooks/useBookings.ts`:
the path under `isSupabaseConfigured` must use `supabase.rpc(...)`,
not `supabase.from('bookings').insert(...)`. Migration 0010 removed
the wildcard insert policy on purpose.

### Edge Function logs

```bash
supabase functions logs <function-name> --follow
```

The boot console of every function logs whether its required secrets
are set. Missing secret → 503 with a clear message.

### Rolling back a bad migration

You can't `down`-migrate in Supabase (forward-only). To recover:
1. Take a fresh `pg_dump` of the project.
2. Drop the offending objects manually in the SQL editor.
3. Fix the migration file and re-run `supabase db push`.
4. Always test migrations on a Supabase **preview branch** first
   (Dashboard → Branches → New branch).

---

## Operating: routine work after launch

- **Daily**: scan `/admin/platform` for new vendor approval requests.
- **Weekly**: read `audit_log` for anything anomalous.
- **Monthly**: verify backups by spinning up a fresh project from a
  `pg_dump` and running `/health` against it.
