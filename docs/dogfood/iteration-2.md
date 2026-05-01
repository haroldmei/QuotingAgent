# Dogfood Report — Iteration 2

## Date: 2026-05-01
## Verdict: SHIP (preview-tier scope)
## Overall health: 8.5 / 10

## Iteration 2 — fixes applied since iter-1

| ID | Severity | Surface | Fix |
|----|----------|---------|------|
| DF-001 | Critical | middleware | Updated `src/middleware.ts` PUBLIC_ROUTES + redirect target from `/auth/sign-in` to `/login`. Cold-boot now lands on `/login?redirectTo=%2F`. |
| DF-002 | Critical | middleware | Onboarding redirect target updated from `/auth/onboarding` to `/onboarding`. Onboarding now reachable. |
| DF-003 | Critical | CSP | Added dev-mode `'unsafe-inline'` for `script-src`; production path uses Next.js per-request nonces. Zero CSP violations on cold-boot. |
| DF-004 | High | rate-limit | `src/lib/services/rate-limit.ts` now returns no-op limiter when `UPSTASH_REDIS_REST_URL`/`TOKEN` are unset in non-prod. `/api/quotes/[id]/view` no longer 500s in dev. |
| DF-005 | High | PWA | Generated placeholder PNGs at `public/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`. Manifest installable. |
| DF-006 | High | env | `.env.example` shipped with all 14 required env var groups documented inline. |
| DF-009 | Medium | CSP | Removed invalid `https://o*.ingest.sentry.io` source; replaced with `https://*.ingest.sentry.io`. |
| DF-NEW-001 | Critical | tailwind v4 | Root cause of 24px touch targets: `@tailwindcss/postcss` plugin missing + no postcss config + globals.css missing `@source` directive. Tailwind utilities (`h-12`, `min-h-[48px]`, etc.) were not being generated at all. Installed `@tailwindcss/postcss@4.2.4`, added `postcss.config.mjs`, added `@source "../**/*.{ts,tsx,js,jsx}";` to globals.css. CTA height now 48px ≥ NFR threshold. |

## Cold-boot verification

- **Cold-boot redirect:** `GET /` → 307 → `/login?redirectTo=%2F` → 200 OK ✅
- **Hero copy:** `<h1>Photo to SMS quote in 5 minutes.</h1>` (the wedge sentence verbatim) ✅
- **Subheader:** `Western Sydney trades only.` (ICP filter) ✅
- **Primary CTA height:** 48px on mobile (390×844) and desktop (1280×800) ✅ (was 24px in iter-1)
- **Phone input prefix:** `+61` chip pre-rendered (AU-localised) ✅
- **Console errors:** 0 ✅
- **CSP violations:** 0 ✅
- **Screenshots:** `dogfood/iter-2/01-cold-boot-desktop.png`, `dogfood/iter-2/02-cold-boot-mobile.png`

## Quality gates

All 11 gates pass:
- ✓ typecheck
- ✓ lint
- ✓ seed-integrity
- ✓ unit (237 + 223 adversarial = 460 tests, 100% pass)
- ✓ mutation
- ✓ integration
- ✓ contract (OpenAPI 3.1)
- ✓ e2e (49 chromium pass, 199 skipped pending Supabase env for OTP/RLS-gated flows)
- ✓ a11y
- ✓ lighthouse
- ✓ visual

## Wedge workflow scoring

| Step | Score | Notes |
|------|-------|-------|
| 1. Lead lands (cold boot → login) | 9/10 | Now resolves cleanly. -1 because auth-gated leads tray needs Supabase to verify behind login. |
| 2. Snap photos | n/a (preview tier) | DB-gated; verified in iter-1 design doc + frontend tests. |
| 3-6. AI generate / review / send | n/a (preview tier) | Same. |
| 7. Customer one-tap accept | 8/10 | `/q/[token]` endpoint returns 401/410 correctly when Redis unset; passes contract tests. |
| 8-10. Follow-up / FSM / Learn | n/a | Backend wired; surfaces require seeded DB to exercise. |

Public surfaces score (login, onboarding, /q public view, manifest, sw): **8.5/10 average**.

## Outstanding (deferred to preview deploy)

- DF-007: Supabase seeded preview deploy (next phase — `deployer` for `preview` tier wires Vercel/Fly with seeded env)
- DF-008: Marketing landing page (next phase — `landing-page`)
- DF-010: PUBLIC_ROUTES still includes `/api/quotes/` (broader than `/accept` + `/decline`); flagged for follow-up audit

## Verdict rationale

The cold-boot regression that anchored iter-1's RETHINK score is fully resolved. The remaining wedge-workflow steps are DB-gated and will be exercised once the preview deploy is seeded — but the structural blockers (routing contract, CSP, Tailwind utility generation, missing icons, missing env scaffold) are all gone.

For preview-tier scope, this is **SHIP** — proceed to pricing → positioning → landing-page → legal → preview-ship → human GO/NO-GO.
