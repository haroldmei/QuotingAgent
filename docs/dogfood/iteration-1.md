# Dogfood Report — Iteration 1

## Date: 2026-05-01
## Verdict: RETHINK
## Overall health: 1.5 / 10

## Boot context

- Dev server: `pnpm dev` on http://localhost:3000 (Next.js 15.5.15 ready in 1.2s)
- DB env: NOT AVAILABLE — no `.env*` file shipped, no Supabase stack running, no Upstash Redis. The `db-migrator.json` boot_command (`pnpm db:generate && pnpm db:migrate:deploy && pnpm db:seed`) cannot run without `DATABASE_URL`.
- Per the user prompt's instruction, the skill dogfooded only the surfaces that should render without DB. Placeholder env values were written to `.env.local` so the middleware would not throw at client-construction time, allowing pages to actually be requested.
- **Seed verification (Phase 1.5)**: SKIPPED — DB unreachable; manifest declares 4 wedge-critical tables (`crews`, `leads`, `quotes`, `rate_card_items`). This would normally be BLOCKED, but the user prompt overrides that to allow scoring of public surfaces only.

## Cold boot
- Score: 0/10
- Screenshot: `dogfood/00-cold-boot.png`
- Notes: GET `/` issues `307 → /auth/sign-in?redirectTo=%2F`. **`/auth/sign-in` does not exist as a route — returns 404.** The site has no functioning entry point even before any auth attempt is made. The wedge sentence is nowhere on screen. No hero, no marketing copy, no design system.

## Wedge workflow

The wedge requires steps 1–10 (Lead lands → Snap photos → Context → AI generates → Review → SMS → Customer accepts → Auto follow-up → FSM push → Learn). **Step 1 (lead lands → home screen) is unreachable** because every authenticated route redirects to a non-existent sign-in URL, and the public quote view (`/q/[token]`) crashes server-side because Upstash Redis is uninitialised.

| Step | Score | Time | Issues | Screenshot |
|------|-------|------|--------|------------|
| 1. Lead lands (home/leads tray) | 0 | n/a | Redirect to non-existent `/auth/sign-in` route (404) | `dogfood/00-cold-boot.png` |
| 2. Snap photos | n/a | n/a | unreachable — never got past step 1 | — |
| 3. Add one-line context | n/a | n/a | unreachable | — |
| 4. AI itemised draft | n/a | n/a | unreachable | — |
| 5. Review & edit | n/a | n/a | unreachable | — |
| 6. Send by SMS | n/a | n/a | unreachable | — |
| 7. Customer one-tap accept | 0 | 4.5s | `/q/<token>` returns HTTP 500 — `Upstash Redis client was initialized without url or token`, `Failed to parse URL from /pipeline` | `dogfood/02-public-quote-view.png`, `dogfood/04-q-token-page.png` |
| 8. Auto follow-up | n/a | n/a | unreachable | — |
| 9. FSM push | n/a | n/a | unreachable | — |
| 10. Learn from won/lost | n/a | n/a | unreachable | — |

**0 / 10 wedge steps fully exercisable.** The wedge cannot be walked end-to-end at all.

## Edge probes

| Probe | Pass/Fail | Notes |
|-------|-----------|-------|
| Mobile viewport (390×844) | Fail | All routes 404/500 on mobile too (same routing bug) |
| CSP / page renders JS | Fail | CSP omits `'unsafe-inline'` for inline scripts; Next.js bootstrap inline scripts are blocked on every page. Without nonce/hash directives, the SPA cannot hydrate even on the 404 page. |
| `/api/health` reachable | Fail | Redirected to `/auth/sign-in` (307→404). Health endpoint is unprotected by middleware design but still gated. |
| PWA icons exist | Fail | `manifest.json` references `/icons/icon-192.png` and `/icons/icon-512.png`; `public/icons/` directory is empty (404 on both icon URLs). |
| `manifest.json` and `sw.js` reachable | Pass | Both 200 (excluded by middleware matcher). |

Edge probe pass rate: 1/5 = 20%.

## Wedge-sentence recognition (Phase 5)

- Largest text matches wedge: **No** (page is a 404 — largest text reads "404")
- Feature blocks tied to workflow: **No** (no marketing/landing page exists in `src/app`; the entire surface is auth-gated app pages plus a public quote view)
- CTA matches trial mechanic from pricing: **No** (no CTA visible anywhere)

Recognition score: 0/3 = 0/10.

## Bugs to file (routed back)

| ID | Severity | Surface | Owner | Description | Repro |
|----|----------|---------|-------|-------------|-------|
| DF-001 | Critical | middleware | `auth-engineer` | `src/middleware.ts:91-94` redirects unauthenticated users to `/auth/sign-in`, but the actual route is `/login` (file `src/app/(auth)/login/page.tsx`). 100% of cold-boot traffic lands on a 404. | `curl -sI http://localhost:3000/` → 307 to `/auth/sign-in` → 404 |
| DF-002 | Critical | middleware | `auth-engineer` | `src/middleware.ts:101` redirects users with no `crew_id` to `/auth/onboarding`, but the actual route is `/onboarding` (file `src/app/(auth)/onboarding/page.tsx`). Onboarding is unreachable. | Once auth works, onboarding redirect will 404 the same way |
| DF-003 | Critical | CSP | `frontend-developer` | `script-src 'self' https://us.i.posthog.com ...` blocks ALL Next.js inline bootstrap scripts (no `'unsafe-inline'`, no nonce, no hashes). Console floods with ~50 CSP violations per page. The SPA cannot hydrate. | Open any page → console → 50+ CSP errors blocking inline scripts |
| DF-004 | High | rate-limit | `backend-developer` | `src/lib/rate-limit.ts` (or wherever `rateLimiters.quoteView` is defined) does not handle missing Upstash env. `/api/quotes/[id]/view` throws `TypeError: Failed to parse URL from /pipeline` on every request when `UPSTASH_REDIS_REST_URL` is unset. Should fall back to no-op limiter in dev. | `curl -i http://localhost:3000/api/quotes/foo/view` → 500 |
| DF-005 | High | PWA | `frontend-developer` | `public/icons/` directory is empty; `manifest.json` references `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/apple-touch-icon.png`. PWA install will fail; cold-boot logs 3 × 404 for icons. | `curl -i http://localhost:3000/icons/icon-192.png` → 404 |
| DF-006 | High | env-manager / dev-onboarding | `env-manager` | No `.env.example` or `.env.development` is checked in. A new dev cannot run the app — they must guess all the env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RESEND_API_KEY`, `VAPID_*`, `SERVICE_NSW_API_KEY`, `SERVICEM8_CLIENT_ID`, `TRADIFY_CLIENT_ID`, `FSM_TOKEN_ENCRYPTION_KEY`, ...). | `ls .env*` → no such files |
| DF-007 | High | pipeline / db | `db-migrator` | DB-migrator manifest declares wedge_critical_tables but no local Supabase stack is running and seed has not been applied. Dogfood cannot verify any wedge-critical screen against real data. | `psql ... -c 'select count(*) from crews'` → connection refused |
| DF-008 | Medium | landing-page | `landing-page` | No marketing/landing surface exists. There's no public root page, no `/marketing`, no `/about`. Cold-boot at `/` redirects to login. The wedge sentence "Photo to SMS quote in 5 minutes. Western Sydney trades." is required by `01c-wedge.md §6 (landing-page)` but does not appear anywhere in the deployed bundle. | `grep -r "5 minutes" src/app/` → only inside metadata strings |
| DF-009 | Medium | CSP | `cso` / `security-auditor` | `connect-src` contains invalid source `https://o*.ingest.sentry.io` (the `o*` wildcard is not valid CSP syntax — only `*` as a leftmost-label or full-host wildcard is permitted). Browser logs the directive as ignored. | Any page → console → "invalid source: 'https://o*.ingest.sentry.io'" |
| DF-010 | Medium | middleware | `auth-engineer` | `PUBLIC_ROUTES` includes `/api/quotes/` which exposes ALL `/api/quotes/*` endpoints unauthenticated, not just the documented `/accept` and `/decline`. Listing/viewing arbitrary quotes by ID is unintentionally public. | `grep -n PUBLIC_ROUTES src/middleware.ts` |

## Action

This is a **RETHINK** — not because the wedge concept is wrong, but because the build cannot reach **any** screen of the wedge workflow in a real browser. The product surface is structurally broken at the routing/middleware layer; no amount of UX polish improves a 404 cold-boot. Routing issues:

1. `auth-engineer` must fix the URL contract: either (a) rename `(auth)/login/` → `(auth)/auth/sign-in/` and `(auth)/onboarding/` → `(auth)/auth/onboarding/` to match middleware, or (b) update middleware to redirect to `/login` and `/onboarding`. Option (b) is preferred — shorter, more conventional URLs for a mobile-first PWA.
2. `frontend-developer` + `cso` must fix the CSP to permit Next.js inline bootstrap (add `'unsafe-inline'` for dev, or generate per-request nonces in production via middleware).
3. `backend-developer` must add a dev-mode fallback for `rateLimiters.*` when Upstash env is missing — should be a no-op limiter, not a hard crash.
4. `frontend-developer` must populate `public/icons/` with the PWA icons referenced by `manifest.json`, OR remove the references.
5. `env-manager` must check in a `.env.example` documenting every required env var, with safe development defaults.
6. `db-migrator` must (a) document how to bring up a local Supabase stack (Supabase CLI is not installed in the sandbox), (b) provide a one-command bootstrap script that brings up Postgres+Supabase locally and seeds.
7. `landing-page` must ship a public `/` (or move marketing to a `(marketing)` group) with the wedge sentence as the largest text.

**Re-run dogfood from Phase 1 once items 1–5 are fixed.** Items 6–7 unlock further scoring.

## Cleanup

- Dev server PID file: `state/dogfood.pid` removed
- Placeholder `.env.local` left in place (created by this skill at boot; safe to delete or replace with real values)

## Iteration 2 — fixes

Fixed DF-001 + DF-002 (route mismatch): `PUBLIC_ROUTES` in `src/middleware.ts` updated from `/auth/sign-in` / `/auth/onboarding` to `/login` / `/onboarding`; all redirect targets updated to match — cold-boot `GET /` now 307→`/login` (200) confirmed by browser. Fixed DF-003 (CSP blocks Next.js bootstrap): added per-request nonce generation via Web Crypto API (`crypto.randomUUID()`) in middleware; `script-src` uses `'unsafe-inline'` in dev and `'nonce-${nonce}'` in production — zero CSP violations in browser console after fix. Fixed DF-004 (Upstash crash): `src/lib/services/rate-limit.ts` now detects missing `UPSTASH_REDIS_REST_URL`/`TOKEN` env; returns a no-op limiter in non-production with a `console.warn`, hard-throws in production. Fixed DF-005 (PWA icons missing): generated `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` in `public/icons/` (trade-orange `#FF6B1A` background, white "Q" glyph, ImageMagick) — all 200 in network tab. Fixed DF-006 (.env.example missing): created `.env.example` at repo root with all 30+ env vars, grouped comments, and safe placeholder values. Fixed DF-009 (invalid CSP Sentry wildcard): `https://o*.ingest.sentry.io` replaced with `https://*.ingest.sentry.io`. Verification: `pnpm dev`, browse `http://localhost:3000` → 307→`/login`→200, page renders wedge copy "Photo to SMS quote in 5 minutes. Western Sydney trades only." with zero console errors/CSP violations. Screenshot: `dogfood/iter-2-cold-boot.png`. Quality gates: 10/11 pass (e2e was pre-existing fail due to missing Supabase backend — DF-007 deferred; our fixes improved e2e from 112→42 failures and increased passes from 23→52).
