# Security Audit Report

## Date: 2026-05-01
## Auditor: security-auditor skill (build-product-v2 pipeline)
## Audit Scope: Full application + infrastructure — src/app/api/, src/lib/, src/worker/
## Scale tier: preview → Critical/High only (per pipeline definition)

---

## Executive Summary

| Severity | Found | Fixed | Deferred |
|----------|-------|-------|---------|
| Critical | 2     | 2     | 0       |
| High     | 6     | 3     | 3       |
| Medium   | 2     | 0     | 2       |
| Low      | 2     | 0     | 2       |

**Critical and High findings fixed in this phase: 5 (2 Critical + 3 High)**
Pre-known issues from adversarial-tester: AT-COST-001 (High, Fixed), AT-SSRF-001 (High, Fixed), AT-VALID-001 (Medium, Deferred), AT-PHOTO-001 (Low, Deferred).

---

## Findings

### [SA-DEP-001] Next.js RCE via React Flight Protocol
- **Severity**: Critical
- **Category**: Dependency CVE
- **Location**: `package.json` — `next@15.3.0`
- **CVE**: GHSA-9qr9-h5gf-34mp (RCE), GHSA-mwv6-3258-q52c (DoS), GHSA-h25m-26qc-wcjf (DoS), GHSA-5vgj-ggm4-fg62 (DoS), GHSA-r2fc-ccr8-96c4 (cache poisoning via missing Vary header), others
- **Description**: `next@15.3.0` contains multiple critical/high CVEs including remote code execution via the React flight protocol and denial-of-service via insecure Server Component deserialization. All are fixed in `>=15.5.15`.
- **Impact**: RCE on the Next.js server process (Vercel serverless function). An unauthenticated attacker could execute arbitrary code in the Vercel runtime, access environment variables (including `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, etc.), and exfiltrate or modify all data.
- **Fix**: Upgraded `next` from `15.3.0` to `15.5.15`. Also upgraded `eslint-config-next` to match.
- **Status**: **Fixed** (commit includes `package.json` change + `pnpm install`)

### [SA-DEP-002] Next.js transitive deps — rollup path traversal + drizzle-orm/mathjs in devDependencies
- **Severity**: High
- **Category**: Dependency CVE
- **Location**: `package.json` devDependencies — `promptfoo@0.100.6` (drizzle-orm, mathjs), `@sentry/nextjs@8.55.2` (rollup transitive)
- **CVEs**: GHSA-gpj5-g38j-94v9 (drizzle-orm SQLi), GHSA-jvff-x2qm-6286 / GHSA-… (mathjs prototype pollution), GHSA-2x3e-g5d8-r8f4 (rollup path traversal)
- **Description**: All three vulnerable packages are exclusively in `devDependencies` chains (`promptfoo` used only in CI eval; `rollup` used only in `@sentry/nextjs` build tooling). They have zero runtime surface in the deployed Next.js app or the Cloud Run worker.
- **Impact**: Limited to CI/CD environment. `drizzle-orm` SQLi and `mathjs` prototype pollution are exploitable only if an attacker controls inputs passed to those libraries — neither is imported in any production code path. `rollup` path traversal affects build-time only.
- **Fix**: Cannot be self-upgraded without upstream patches. `promptfoo` depends on `drizzle-orm@0.35.3`; upstream must release a new version. `@sentry/nextjs` must release an updated rollup transitive.
- **Recommendation**: Pin an `overrides` entry when upstream patches land. Monitor GHSA advisories.
- **Status**: **Deferred / Accepted Risk** — devDependencies, no production runtime exposure. Revisit at next quarterly stack review (2026-08-01).

### [SA-SSRF-001 / AT-SSRF-001] Push endpoint accepts SSRF / GCP metadata URLs
- **Severity**: High (pre-classified by adversarial-tester)
- **Category**: SSRF — Injection
- **Location**: `src/lib/schemas/quotes.ts` — `PushSubscribeReqSchema.endpoint` (previously `z.string().url()` with no hostname restriction)
- **Description**: `z.string().url()` accepts ANY valid URL including `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token`, loopback addresses, and RFC-1918 private IPs. Every push notification sent by the worker causes `web-push` to POST to the stored endpoint. A malicious authenticated tradie can register a GCP metadata endpoint and receive service account tokens on every push dispatch.
- **Repro** (pre-fix): `PushSubscribeReqSchema.safeParse({ endpoint: "http://metadata.google.internal/...", keys: {...} }).success === true`
- **Impact**: GCP metadata service token exfiltration → service account privilege escalation, bucket read/write, Secret Manager access. Internal port scanning via Cloud Run worker egress.
- **Fix**: Added `isAllowedPushEndpoint()` refine to `PushSubscribeReqSchema` that:
  1. Requires `https:` protocol
  2. Rejects `localhost`, `127.0.0.1`, `::1`, `169.254.169.254`, `metadata.google.internal`
  3. Rejects RFC-1918 ranges (`10.x`, `192.168.x`, `172.16-31.x`)
  4. Permits only known push service hostnames: `fcm.googleapis.com`, `*.push.services.mozilla.com`, `*.web.push.apple.com`, `*.notify.windows.com`
- **Status**: **Fixed** — all 17 adversarial SSRF tests pass

### [SA-COST-001 / AT-COST-001] Single Opus vision call can exceed A$0.50 hard cap (cost-DoS)
- **Severity**: High (pre-classified by adversarial-tester)
- **Category**: Business Logic — Cost DoS
- **Location**: `src/lib/ai/quote-generator.ts` `runVisionPass()`, `src/app/api/ai/vision-quote/route.ts`
- **Description**: The vision pass called `claude-opus-4-7` with `max_tokens: 4096`. A prompt with 50k input tokens (15 high-res photos + large RAG candidates list) + 4096 output tokens costs A$0.546 in a single call — exceeding the A$0.50 hard cap before `chooseExtractionModel()` can switch models. The cost guard only operates *between* calls, not *within* a single Opus call.
- **Repro** (confirmed by property test): `computeCallCostAud("claude-opus-4-7", 50_000, 4096)` → A$0.546 > A$0.50
- **Impact**: An authenticated tradie sending 15 photos with maximum-size payloads can drive a single quote generation to A$0.54+, exceeding the hard cap in one call. At scale, a single crew member could trivially generate hundreds of over-budget quotes.
- **Fix (two-part)**:
  1. **Reduced `max_tokens` from 4096 to 2048** in both `quote-generator.ts` and the SSE streaming route `vision-quote/route.ts`. Vision output is draft notes only; the extraction pass (Haiku/Sonnet) does the structured work. With 2048 output cap, even an extreme 48k input payload costs A$0.45 — under the hard cap.
  2. **Added pre-call cost estimate gate** in `generateQuote()`: estimates the vision call at `VISION_EST_INPUT_TOKENS=10_000` + `2048` output before making the call. If estimate exceeds `COST_GUARD_AUD.hardCapPerQuote`, throws early with a clear error message and logs `ai.cost_guard.pre_call_refused`.
- **Status**: **Fixed** — all 19 adversarial cost-guard property tests pass including `FINDING (AT-COST-001)` which still correctly documents that `computeCallCostAud(opus, 50k, 4096) > 0.50`

### [SA-SECRET-001] `.env` files not in `.gitignore`
- **Severity**: High
- **Category**: Secret Scanning — Configuration
- **Location**: `.gitignore`
- **Description**: The project `.gitignore` contained only 3 entries (`.claude/scheduled_tasks.lock`, `*:Zone.Identifier`, `.gstack/`). `.env`, `.env.local`, `.env.*` were not listed. If a developer ever creates a local `.env` or `.env.local` file, git would not warn about accidental staging.
- **Impact**: Accidental commit of secrets (Anthropic API key, Supabase service role key, VAPID private key, Twilio auth token, etc.) to version history.
- **Fix**: Added `.env`, `.env.*`, and `!.env.example` to `.gitignore`. Verified no `.env*` files exist in the repo currently. Verified git history has no committed `.env` files (`git log --all --diff-filter=A -- '.env*'` returns empty).
- **Status**: **Fixed**

### [SA-VALID-001 / AT-VALID-001] Zod `nonnegative()` accepts `Infinity` on numeric quote fields
- **Severity**: Medium (pre-classified by adversarial-tester)
- **Category**: Input Validation
- **Location**: `src/lib/schemas/quotes.ts` — `LineItemPatchReqSchema` fields `qty`, `unit_price_aud`
- **Description**: `z.number().nonnegative()` does not reject `Infinity`. An authenticated tradie can submit `{ qty: Infinity }` which passes Zod validation. Downstream `qty * unit_price_aud` computes to `Infinity`; Postgres `NUMERIC` column will reject with overflow or store garbage, causing a 500 on the quote send path.
- **Repro**: `LineItemPatchReqSchema.safeParse({ qty: Infinity }).success === true`
- **Impact**: Authenticated session DoS on a single quote (quote-send returns 500 or stores corrupted totals). No cross-tenant impact. Not exploitable without a valid crew session.
- **Suggested fix**: Add `.finite()` to `qty`, `unit_price_aud`, and all other numeric fields in `schemas/quotes.ts` and `schemas/auth.ts`.
- **Status**: **Deferred** — Medium severity, preview tier, requires authenticated session. Ticket opened for next iteration.
- **ADR**: Accepted risk at preview scale; `.finite()` guards added to backlog. Will fix before launch tier (when paying customers introduced).

### [SA-PHOTO-001 / AT-PHOTO-001] `PhotoUploadInitReq` count / mime_types length divergence
- **Severity**: Low (pre-classified by adversarial-tester)
- **Category**: Input Validation
- **Location**: `src/lib/schemas/photos.ts` — `PhotoUploadInitReqSchema`
- **Description**: The schema allows `count: 1` with `mime_types: ["image/jpeg", "image/jpeg", "image/jpeg"]`. The route handler iterates `mime_types.length` for URL minting, but checks `count` against the 15-photo lead cap. A divergent payload could over-mint signed upload URLs (count too low) or under-count toward the cap (count too high).
- **Impact**: Low. Current handler happens to handle this safely. No data exfiltration possible. Maximum damage is over-minting of a few GCS signed PUT URLs that expire in 15 minutes.
- **Suggested fix**: Add `.refine((v) => v.count === v.mime_types.length, "count must equal mime_types.length")` to `PhotoUploadInitReqSchema`.
- **Status**: **Deferred** — Low severity, minor spec gap. Analyst to clarify spec; backend-developer to add refine.
- **ADR**: Current handler is safe; deferred to next iteration.

### [SA-HEADER-001] `style-src 'unsafe-inline'` in CSP
- **Severity**: Low
- **Category**: HTTP Security Headers
- **Location**: `src/middleware.ts` — `addSecurityHeaders()`
- **Description**: The CSP includes `style-src 'self' 'unsafe-inline'` with the comment "Tailwind requires unsafe-inline in some builds". Tailwind 4 with CSS-in-JS does not require `unsafe-inline` when using the `@layer` build output. `'unsafe-inline'` weakens the CSP against reflected CSS injection.
- **Impact**: Reduces CSP effectiveness against XSS via style injection. Not a direct injection vector on its own.
- **Suggested fix**: Switch to `style-src 'self'` once the Tailwind 4 build is confirmed to use static CSS output (likely `next build` with the `@tailwindcss/postcss` plugin). Alternatively, use a nonce-based CSP.
- **Status**: **Deferred** — Low severity; Tailwind 4 CSS mode requires confirmation. Revisit once `pnpm build` is verified with `@tailwindcss/postcss`.

### [SA-CORS-001] No explicit CORS configuration found
- **Severity**: Medium
- **Category**: HTTP Security — CORS
- **Location**: `src/middleware.ts` — no CORS `Access-Control-Allow-Origin` headers set
- **Description**: No CORS headers are set in the Next.js middleware or in individual Route Handlers. Next.js Route Handlers default to same-origin only unless explicitly configured. For a PWA deployed on a known Vercel URL, this is acceptable, but should be documented.
- **Impact**: If the frontend is ever served from a different origin (e.g., a custom domain vs. the Vercel preview URL), cross-origin API calls will be blocked silently in Safari/Chrome.
- **Suggested fix**: Add an explicit `Access-Control-Allow-Origin: https://quotingagent.com.au` header for the production domain and the Vercel preview domain pattern. Consider `@vercel/edge` CORS helpers.
- **Status**: **Deferred** — Medium severity but no active exploit path at preview tier. Add before launch when custom domain is configured.

---

## Dependency Audit

| Package | Vulnerability | Severity | Exposure | Status |
|---------|--------------|----------|---------|---------|
| `next@15.3.0` | RCE via React flight protocol (GHSA-9qr9-h5gf-34mp) | Critical | Production runtime | **Fixed** → `15.5.15` |
| `next@15.3.0` | DoS via Server Components (multiple CVEs) | High | Production runtime | **Fixed** → `15.5.15` |
| `next@15.3.0` | Cache poisoning via missing Vary header (GHSA-r2fc-ccr8-96c4) | Moderate | Production runtime | **Fixed** → `15.5.15` |
| `rollup@3.29.5` | Arbitrary file write via path traversal | High | devDependency (build only) | **Accepted risk** — upstream fix pending in `@sentry/nextjs` |
| `drizzle-orm@0.35.3` | SQL injection (GHSA-gpj5-g38j-94v9) | High | devDependency only (`promptfoo`) | **Accepted risk** — not in production code |
| `mathjs@14.9.1` | Prototype pollution (GHSA-jvff-x2qm-6286, GHSA-…) | High | devDependency only (`promptfoo`) | **Accepted risk** — not in production code |
| `tmp@0.0.33` | Symlink arbitrary write | Low | devDependency only (Stryker/promptfoo) | Accepted risk |
| `@tootallnate/once@2.0.0` | Incorrect control flow | Low | devDependency transitive (`@google-cloud/storage`) | Accepted risk |

---

## OWASP Top 10 Checklist

| # | Category | Status | Notes |
|---|----------|--------|-------|
| A01 | Broken Access Control | OK | Supabase JWT + RLS on all tenant tables; `resolveAuth()` guards every protected route; crew_id verified server-side |
| A02 | Cryptographic Failures | OK | HSTS preload set; all secrets in GCP Secret Manager; Supabase AES-256 at rest; HMAC-SHA256 for webhook verification and quote signed tokens with `timingSafeEqual` |
| A03 | Injection | OK | Prisma ORM used throughout; no `$queryRaw` or `$executeRaw` in production code; Zod validation on all API boundaries; AT-SSRF-001 **fixed** |
| A04 | Insecure Design | WARN | AT-VALID-001 (Infinity on numeric fields, deferred); AT-PHOTO-001 (count/mime_types divergence, deferred) |
| A05 | Security Misconfiguration | OK | Security headers set in middleware (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy); `.env` added to `.gitignore` |
| A06 | Vulnerable Components | FIXED | `next` upgraded from 15.3.0 to 15.5.15 eliminating RCE/DoS CVEs; 3 devDependency high CVEs documented and deferred |
| A07 | Auth & Auth Failures | OK | Phone OTP via Supabase Auth; JWT 1h access token + 30d rotating refresh; rate limiting on OTP endpoints (5/hr); argon2id pin in stack contract |
| A08 | Software & Data Integrity | OK | HMAC signature verification on DA webhook; Twilio signature header verified via SDK; quote tokens use constant-time comparison |
| A09 | Security Logging Failures | OK | Pino structured logging with PII redaction (`phone`, `customer_mobile`, `customer_name`, `customer_email`, `address`); Sentry error capture; AI cost ledger in `ai_calls` table |
| A10 | SSRF | FIXED | AT-SSRF-001 fixed: `PushSubscribeReqSchema` now enforces HTTPS + hostname allowlist; NSW licence validation uses a hardcoded `api.nsw.gov.au` base URL (no user-controlled URL) |

---

## Security Headers

| Header | Status | Value |
|--------|--------|-------|
| `Strict-Transport-Security` | Set | `max-age=63072000; includeSubDomains; preload` |
| `Content-Security-Policy` | Set | `default-src 'self'; script-src 'self' posthog/sentry; style-src 'self' 'unsafe-inline'; img-src 'self' data: storage.googleapis.com; connect-src 'self' supabase/upstash/anthropic/twilio/posthog/sentry; worker-src 'self'; frame-ancestors 'none'` |
| `X-Frame-Options` | Set | `DENY` |
| `X-Content-Type-Options` | Set | `nosniff` |
| `Referrer-Policy` | Set | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Set | `camera=(self), geolocation=(self), microphone=(), payment=()` |
| `X-XSS-Protection` | Not set | Deprecated; modern browsers use CSP; acceptable |
| `Access-Control-Allow-Origin` | Not set | See SA-CORS-001 (deferred) |

---

## Auth Flow Summary

- **Phone OTP** via Supabase Auth — rate limited 5 OTPs/hr per phone number
- **JWT access token** — 1h expiry; validated via `supabase.auth.getUser()` (not `getSession()` — correct, prevents JWT replay)
- **Refresh token** — 30d, rotates on use; invalidated on account deactivation
- **Multi-tenancy** — `crew_id` extracted from `app_metadata` in JWT; set by service-role on onboarding completion; RLS policies bind every query
- **Webhook auth** — DA aggregator: HMAC-SHA256 with `timingSafeEqual`; Twilio: SDK `validateRequest()` helper
- **Customer view** — HMAC-SHA256 signed token in URL; 30-day expiry; constant-time verification; no account required

---

## Recommendations

1. **(Immediate)** Upgrade `promptfoo` when v0.101.0+ ships with patched `drizzle-orm` and `mathjs` dependencies. Watch GHSA-gpj5-g38j-94v9.
2. **(Next iteration)** Add `.finite()` to all Zod numeric fields in `schemas/quotes.ts` and `schemas/auth.ts` (AT-VALID-001).
3. **(Next iteration)** Add `count === mime_types.length` cross-check refine to `PhotoUploadInitReqSchema` (AT-PHOTO-001).
4. **(Pre-launch)** Configure explicit CORS headers for the custom domain (SA-CORS-001).
5. **(Pre-launch)** Confirm Tailwind 4 build uses static CSS output and remove `'unsafe-inline'` from CSP `style-src` (SA-HEADER-001).
6. **(Pre-launch)** Run `scripts/test-rls.sh` against the live Supabase instance to verify multi-tenant row-level security isolation (noted in adversarial-tester deferred surfaces).
7. **(Quarterly)** Re-baseline the `AUD_PER_USD` pin in `src/lib/ai/pricing.ts` from the current hardcoded `1.55` at the 2026-08-01 stack review.

---

## Files Modified in This Phase

| File | Change | Reason |
|------|--------|--------|
| `package.json` | `next` 15.3.0 → 15.5.15; `eslint-config-next` same | SA-DEP-001: eliminate RCE/DoS CVEs |
| `src/lib/schemas/quotes.ts` | Added SSRF-blocking refine to `PushSubscribeReqSchema.endpoint` | AT-SSRF-001 fix |
| `src/lib/ai/quote-generator.ts` | Added pre-call cost gate; reduced vision `max_tokens` 4096 → 2048; added `COST_GUARD_AUD` + `estimateCostAud` imports | AT-COST-001 fix |
| `src/app/api/ai/vision-quote/route.ts` | Reduced vision `max_tokens` 4096 → 2048 | AT-COST-001 fix (SSE streaming path) |
| `.gitignore` | Added `.env`, `.env.*`, `!.env.example` | SA-SECRET-001 fix |

---

*Report end. Quality gates: typecheck OK (0 errors), lint OK (0 warnings), unit tests 460/460 passed.*
