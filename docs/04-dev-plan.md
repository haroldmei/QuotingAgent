# Dev Plan — QuotingAgent

<!-- WEDGE: For 1–10 staff Western Sydney trade owners, a site photo becomes an SMS-sent, AU-priced, NSW-licence-bound quote in under 5 minutes. -->

> Version: 2.0 — 2026-05-01
> Phase: backend-developer (build-product-v2 pipeline)
> Stack contract: docs/00-tech-stack.md (BINDING)

---

## Auth Layer (auth-engineer output — already done)

### Provider: Supabase Auth

Auth routes already implemented:
- `POST /api/auth/otp` — phone OTP start + verify
- `POST /api/auth/onboarding` — crew + user creation
- `POST /api/crew/licence-validate` — NSW licence re-validation

---

## Backend Tasks (backend-developer phase)

### Module A: Zod Schemas (shared contracts)

- [x] ✅ **A1** [Backend] Lead schemas (ManualLeadReq, LeadPatch, LeadList)
- [x] ✅ **A2** [Backend] Photo upload schemas (PhotoUploadInit, PhotoCommit)
- [x] ✅ **A3** [Backend] Quote schemas (QuoteEnqueue, QuoteDraft, LineItemPatch, SendReq)
- [x] ✅ **A4** [Backend] Webhook schemas (DaWebhook, TwilioDelivery)
- [x] ✅ **A5** [Backend] Acceptance / decline schemas
- [x] ✅ **A6** [Backend] Push subscription schema
- [x] ✅ **A7** [Backend] FSM / notifications schemas

### Module B: Lib / Services

- [x] ✅ **B1** [Backend] GCS helper — signed PUT URL generation, EXIF-preserving upload
- [x] ✅ **B2** [Backend] Twilio SMS service — send AU long-code, signature verification
- [x] ✅ **B3** [Backend] PDF generation service — react-pdf quote PDF, GCS store, signed URL
- [x] ✅ **B4** [Backend] Web Push helper — VAPID send, subscription management
- [x] ✅ **B5** [Backend] Quote calculation helpers — GST (10%), subtotal, total, recalculate
- [x] ✅ **B6** [Backend] HMAC signing — DA webhook verify, quote signed-token mint/verify
- [x] ✅ **B7** [Backend] Resend email fallback service
- [x] ✅ **B8** [Backend] FSM connector — ServiceM8 + Tradify OAuth token encrypt/decrypt, job push
- [x] ✅ **B9** [Backend] Rate limiter factory (shared Upstash Redis instance)

### Module C: Lead API routes

- [x] ✅ **C1** [Backend] `GET /api/leads` — list leads with cursor pagination, RLS
- [x] ✅ **C2** [Backend] `POST /api/leads` — create manual lead, RLS
- [x] ✅ **C3** [Backend] `GET /api/leads/[id]` — lead detail, RLS
- [x] ✅ **C4** [Backend] `PATCH /api/leads/[id]` — update lead, RLS
- [x] ✅ **C5** [Backend] `POST /api/leads/[id]/photos` — photo upload signed URL + commit
- [x] ✅ **C6** [Backend] `POST /api/leads/[id]/quote` — enqueue AI quote job via BullMQ
- [x] ✅ **C7** [Backend] `GET /api/leads/[id]/quote` — get latest quote draft

### Module D: Quote API routes

- [x] ✅ **D1** [Backend] `GET /api/quotes/[id]` — fetch quote with line items (RLS)
- [x] ✅ **D2** [Backend] `PATCH /api/quotes/[id]` — tradie edits line items, recalculate totals
- [x] ✅ **D3** [Backend] `POST /api/quotes/[id]/send` — PDF gen + Twilio SMS + schedule followups
- [x] ✅ **D4** [Backend] `POST /api/quotes/[id]/accept` — public signed-URL accept (no-auth)
- [x] ✅ **D5** [Backend] `GET /api/quotes/[id]/view` — public quote view (signed-URL gate)

### Module E: Webhook handlers

- [x] ✅ **E1** [Backend] `POST /api/leads` (DA webhook) — `POST /api/webhooks/da-lead` HMAC verify + lead creation
- [x] ✅ **E2** [Backend] `POST /api/webhooks/twilio/delivery` — Twilio status callback, lead status update
- [x] ✅ **E3** [Backend] `GET /api/webhooks/twilio/read` — read-receipt tracking pixel

### Module F: Notifications & FSM

- [x] ✅ **F1** [Backend] `POST /api/notifications/push/subscribe` — save VAPID push subscription
- [x] ✅ **F2** [Backend] `GET /api/fsm/[provider]/oauth/start` — redirect to FSM OAuth
- [x] ✅ **F3** [Backend] `GET /api/fsm/[provider]/oauth/callback` — exchange code, encrypt + save token

### Module G: BullMQ Worker

- [x] ✅ **G1** [Backend] Worker entrypoint (`src/worker/index.ts`) — connect to Upstash Redis, start BullMQ workers
- [x] ✅ **G2** [Backend] `process-quote` job — vision → extraction → persist quote rows, push notification
- [x] ✅ **G3** [Backend] `followup-sms` job — D+3 / D+7 SMS nudge, AEST guard
- [x] ✅ **G4** [Backend] `rate-card-refresh` cron — Bunnings scrape/API, embed new items, mark stale
- [x] ✅ **G5** [Backend] `fsm-push` job — ServiceM8 / Tradify job creation on quote accept

### Module H: Tests

- [x] ✅ **H1** [Backend] Unit tests — quote calc, HMAC signing, Twilio signature, GST rounding
- [x] ✅ **H2** [Backend] Route handler tests (vitest + mocked Supabase) — leads CRUD, quote flow, webhooks
- [x] ✅ **H3** [Backend] Worker job tests — process-quote mock, followup-sms timing, fsm-push
- [x] ✅ **H4** [Backend] Integration smoke tests — data round-trip for Lead, Quote, SmsEvent

---

## Open issues carried forward

| # | Issue | Blocks |
|---|---|---|
| OI-001 | NSW statutory warranty exact wording — legal review required | FR-025 |
| OI-002 | DA aggregator webhook contract | FR-006 |
| OI-003 | Bunnings PowerPass API access | FR-013 |
| OI-004 | 50-photo gold standard set | FR-031 |
| OI-005 | ServiceM8 OAuth partner application | FR-027 |
| OI-006 | A$99/mo vs 3% commission at V1 | Pricing |
| OI-007 | ABN captured at onboarding (added to OnboardingReqSchema as optional) | NFR-020 |
| OI-008 | Supabase JWT custom claim hook — crew_id must be configured in Supabase Auth → Hooks dashboard | auth.crew_id() RLS |
