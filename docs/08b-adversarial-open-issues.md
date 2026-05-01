# Adversarial-tester open issues — Iteration 1 (2026-05-01)

These issues were found by the adversarial-tester pass and are ready for
the orchestrator's `state/open_issues` queue. Each is reproducible via
the named test in `tests/adversarial/`.

## AT-COST-001 (High) — Single Opus call can exceed per-quote hard cap

**Surface**: AI cost runaway (`src/lib/ai/client.ts`, `src/lib/ai/quote-generator.ts`)
**NFR violated**: NFR-005 (mean A$0.30/quote) — hard cap A$0.50 trippable in *one* call
**Test**: `tests/adversarial/properties/cost-guard-properties.test.ts:FINDING (AT-COST-001)`
**Repro**: `computeCallCostAud(MODELS.vision, 50_000, 4096)` → A$0.546 — already over
hard cap before the cost guard has a chance to swap to fallback.
**Owner**: ai-features OR backend-developer
**Suggested fix**:
1. Add a pre-call estimate gate: in `withCostTracking`, refuse the call
   if `estimateCostAud({ model, inputTokens: prompt.estTokens, expectedOutputTokens: max_tokens }) > hardCap`.
2. Reduce `max_tokens` from 4096 to ~2048 for vision (output is mostly
   "draft notes" — extraction does the structured work).
3. Cap the photo-context payload that goes into the vision prompt
   (limit per-photo description string, RAG candidates list size).

## AT-VALID-001 (Medium) — Zod nonnegative accepts Infinity

**Surface**: Request validation (`src/lib/schemas/quotes.ts:LineItemPatchReqSchema`)
**Test**: `tests/adversarial/fuzz/schema-fuzz.test.ts:FINDING (AT-VALID-001)`
**Repro**:
```ts
LineItemPatchReqSchema.safeParse({ qty: Infinity }).success === true
LineItemPatchReqSchema.safeParse({ unit_price_aud: Infinity }).success === true
```
**Impact**: Authenticated tradie or compromised session can submit Infinity
on a line item. Downstream `qty * unit_price_aud = Infinity`; either DB
throws on numeric overflow or stores garbage. Customer sees A$Infinity
total or quote-send 500s.
**Owner**: backend-developer
**Suggested fix**: Add `.finite()` to every numeric Zod field in
`schemas/quotes.ts` (qty, unit_price_aud, subtotal_aud, gst_aud, total_aud,
default_labour_rate_aud) and `schemas/auth.ts:default_labour_rate_aud`.

## AT-SSRF-001 (Medium) — Push endpoint URL accepts SSRF / metadata URLs

**Surface**: Push subscription (`src/lib/schemas/quotes.ts:PushSubscribeReqSchema`)
**Test**: `tests/adversarial/authz/push-subscribe-ssrf.test.ts`
**Repro**:
```ts
PushSubscribeReqSchema.safeParse({
  endpoint: "http://metadata.google.internal/computeMetadata/v1/...",
  keys: { p256dh: "x", auth: "y" }
}).success === true
```
**Impact**: An authenticated tradie (or anyone with a compromised tradie
session) can register a malicious push endpoint. Every push notification
job (and there are many: new lead, quote accepted, quote opened, SMS
delivered) triggers the worker / web-push library to fetch the endpoint.
That hits internal infrastructure → GCP metadata token theft, internal
port scanning, or DoS pivot.
**Owner**: backend-developer
**Suggested fix**: Add a `.refine()` on the endpoint to require an
allow-list of known push services:
- `*.fcm.googleapis.com`
- `*.push.services.mozilla.com`
- `*.web.push.apple.com`
- `*.notify.windows.com`

## AT-PHOTO-001 (Low) — count / mime_types divergence not enforced

**Surface**: Photo upload (`src/lib/schemas/photos.ts:PhotoUploadInitReqSchema`)
**Test**: `tests/adversarial/fuzz/schema-fuzz.test.ts:FINDING (AT-PHOTO-001)`
**Repro**:
```ts
PhotoUploadInitReqSchema.safeParse({ count: 1, mime_types: ["image/jpeg", "image/jpeg", "image/jpeg"] }).success === true
```
**Impact**: Route handler iterates over `mime_types.length` to mint URLs but
checks `count` against the 15-photo lead cap. A divergent payload could
either over-mint URLs (count too high) or under-count toward the cap.
The current handler at `src/app/api/leads/[id]/photos/route.ts` happens
to handle this safely, but the schema-level invariant is missing.
**Owner**: analyst (clarify spec) → backend-developer
**Suggested fix**: Add a `.refine()` cross-check.

## Surfaces deferred (need integration / e2e tier)

- **Multi-tenant RLS enforcement** — needs running Supabase. Current
  schema-level tests cannot exercise the actual `crew_id` boundary on
  SELECT/INSERT/UPDATE policies. Hand to e2e-tester or integration tier.
- **Twilio webhook replay & signature timing** — needs Twilio SDK fixture.
- **ClamAV / EXIF-bomb / multipart-bomb** on uploaded photos — needs a
  GCS-mock surface. Currently only the schema validates mime-type allowlist.
- **Concurrent quote-acceptance double-submit** — needs running Postgres.
  The `quote_acceptances` table has UNIQUE on `quote_id` so the DB-level
  race is closed; but the schedule-followup-cancellation flow (lines
  140–150 of `src/app/api/quotes/[id]/accept/route.ts`) is not idempotent
  on second concurrent accept — `queue.remove` on an already-removed job
  is non-fatal but worth a real-Redis race test.
