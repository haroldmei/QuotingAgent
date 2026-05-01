# Adversarial Test Plan — Iteration 1

## Date: 2026-05-01

The implementer (Sonnet) wrote the backend; this pass (Opus) writes tests
whose only job is to break it. Existing implementer suite was green
(237 tests passing) before this pass began.

## Surfaces in scope

| Surface | Files | Risk priority |
|---------|-------|---------------|
| Quote signed-URL HMAC | `src/lib/services/hmac.ts` | **Critical** — wedge customer-facing accept endpoint |
| DA webhook HMAC | `src/lib/services/hmac.ts`, `src/app/api/webhooks/da-lead/route.ts` | **Critical** — only inbound auth on aggregator boundary |
| Money / GST math | `src/lib/services/quote-calc.ts` | **High** — statutory FR-026 + customer-visible totals |
| AI cost-guard router | `src/lib/ai/client.ts`, `src/lib/ai/pricing.ts` | **High** — controls A$0.30/quote NFR-005 budget |
| Zod request validators | `src/lib/schemas/*.ts` | **High** — public attack surface for fuzzing |
| Twilio SMS body builder | `src/lib/sms/twilio.ts` | **Medium** — char-cap + GSM-7 / unicode segmentation |
| AU mobile validator | `src/lib/schemas/leads.ts`, `auth.ts` | **Medium** — premium-rate / international misroute |

## Test categories planned

- Boundary value tests:        ~28
- Property-based tests:        ~20
- Fuzz tests:                  ~15
- Concurrency / race tests:    ~8
- Abuse / authz tests:         ~14
- Total target:                ≥ 80

## Findings

Recorded after run; see `## Findings` table at bottom.

---

## Run results

- 223 adversarial tests added.
- All 223 pass; full suite (implementer + adversarial) = 460/460 green.
- 3 adversarial tests are written as "expect-the-bug" passing assertions
  (i.e. they assert the system currently exhibits the documented defect
  so a regression-fix flips them).

## Findings

| ID | Severity | Surface | Test file | Repro | Class | Owner |
|----|----------|---------|-----------|-------|-------|-------|
| AT-COST-001 | High | AI cost runaway | tests/adversarial/properties/cost-guard-properties.test.ts | `computeCallCostAud(MODELS.vision, 50_000, 4096) > A$0.50 (hard cap)` — single Opus call with adversarial-sized prompt blows past per-quote hard cap. The cost guard runs BETWEEN calls, not WITHIN. | Real bug | ai-features (or backend-developer) |
| AT-VALID-001 | Medium | Request validation (money) | tests/adversarial/fuzz/schema-fuzz.test.ts (`rejects Infinity qty`, `Infinity unit_price_aud`) | `LineItemPatchReqSchema.safeParse({ qty: Infinity }).success === true`. Zod's `nonnegative()` admits Infinity. Authenticated tradie / compromised session can write Infinity into qty or unit_price; downstream totals become Infinity (or DB throws). | Real bug | backend-developer |
| AT-SSRF-001 | Medium | Push subscription endpoint | tests/adversarial/authz/push-subscribe-ssrf.test.ts (FINDING-CANDIDATE block) | `PushSubscribeReqSchema` accepts ANY URL via `z.string().url()`, including `http://metadata.google.internal/...`, `http://169.254.169.254/...`, `http://127.0.0.1/...`, `file:///etc/passwd`, `gopher://`. The web-push library will fetch the URL on every notification attempt → SSRF / metadata-token theft / internal-port scan. | Real bug | backend-developer |
| AT-PHOTO-001 | Low | Photo upload schema | tests/adversarial/fuzz/schema-fuzz.test.ts (`count and mime_types.length divergence`) | `PhotoUploadInitReqSchema` does not enforce `count === mime_types.length`. Route handler iterates over `mime_types` to mint URLs, but uses `count` for the per-lead 15-photo cap. Confused-deputy candidate; current handler appears safe but the schema-level invariant is missing. | Spec ambiguity | analyst (clarify) → backend-developer |
| AT-COSMETIC-001 | Low | SMS body builder | tests/adversarial/boundary/sms-body-builder.test.ts (`leading-space`) | `customerName` starting with whitespace produces `"Hi , <Trade> has sent..."` — cosmetically ugly but functional. | Test bug-flag (cosmetic only) | none (defer) |
| AT-DENORM-001 | Info | Quote calc rounding | tests/adversarial/properties/quote-calc-properties.test.ts (`FINDING: roundAud(tiny denormal positive)`) | `roundAud(1.4e-45) === 0` — sign collapses for sub-cent values. This is correct monetary behaviour but not documented in the docstring; downstream callers should not rely on `Math.sign(roundAud(x)) === Math.sign(x)`. | Documentation gap | backend-developer (docstring tweak) |

### Severity legend

- **High**: wedge-critical (cost runaway, multi-tenant, customer-facing forge).
- **Medium**: violates an NFR or opens a clear attack path; not exploited
  on the wedge happy path but reachable by a malicious authenticated user
  or compromised endpoint.
- **Low**: defence-in-depth or cosmetic.
- **Info**: documented for future reference; not actionable as a "bug".

### Surfaces NOT yet covered (handed to next iteration)

- DB-level RLS enforcement (multi-tenant) — needs an integration test
  with a real Supabase instance (vitest.integration). Currently only
  schema-level tests are present.
- Twilio webhook signature replay & timing-attack tests — needs a real
  Twilio SDK fixture; deferred to e2e.
- ClamAV / EXIF-bomb / multipart-bomb on uploaded photos — needs a fake
  GCS PUT URL surface; deferred to integration tier.
- Concurrent quote-acceptance double-submit (real race) — needs a
  running Postgres; deferred to integration tier.

### Test count by category

- Boundary value tests:        23 (HMAC clock, SMS body, AU mobile)
- Property-based tests:        36 (quote-calc, cost-guard, monotonicity)
- Concurrency / sequence:      7  (cost guard sequence)
- Authz / forgery / encryption: 52 (HMAC token, FSM AES-GCM, push SSRF)
- Fuzz tests:                  105 (Zod schemas across 15 schemas)
- **Total**:                   223

