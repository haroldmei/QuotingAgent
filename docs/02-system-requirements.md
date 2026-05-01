# System Requirements Specification — QuotingAgent (Western Sydney AI Quoting)

<!-- WEDGE: For 1–10 staff Western Sydney trade owners, a site photo becomes an SMS-sent, AU-priced, NSW-licence-bound quote in under 5 minutes. -->

> Version: 1.0 — 2026-05-01
> Phase: analyst (build-product-v2 pipeline)
> Scale tier: preview
> Stack contract: docs/00-tech-stack.md
> Source documents: docs/01-market-analysis.md, docs/01b-product-spec.md, docs/01c-wedge.md

---

## 1. Introduction

### 1.1 Purpose

This System Requirements Specification (SRS) defines the functional and non-functional requirements for QuotingAgent — an AI-powered quoting product for 1–10 staff residential trade businesses in Western Sydney. It translates the market analysis, product specification, and wedge constraints into developer-ready, testable requirements. Every requirement is tagged with one of:

- **[wedge-critical]** — removing this FR prevents the core wedge from working (photo → SMS quote in ≤ 5 min)
- **[wedge-supporting]** — this FR amplifies the wedge (DA ingest, FSM push, rate-card learning, follow-up)
- **[Out-of-wedge → V2]** — out of wedge scope; must not be built in V1

### 1.2 Scope

**In scope (V1 — preview tier, 6–8 week target):**

- Critical flow: photo capture → AI quote generation → review → SMS delivery → customer acceptance
- Supporting flows: DA-lead ingest, manual lead entry, ServiceM8/Tradify push, auto-follow-up SMS, rate-card learning trigger
- Onboarding: phone-OTP, NSW contractor licence validation
- Multi-tenant crew isolation (RLS)
- AI eval harness (promptfoo, 50-photo gold set)
- PWA mobile-first experience

**Out of scope (V1):**
Invoicing, payments, scheduling, dispatch, timesheets, customer CRM beyond accept/decline, project costing, commercial construction, non-NSW state support, native iOS/Android app, multi-crew dispatch, voice-memo input, Good/Better/Best tiered quotes.

### 1.3 Definitions & Acronyms

| Term | Definition |
|---|---|
| ICP | Ideal Customer Profile — 1–10 staff Western Sydney residential roofer/painter, owner-operator, NSW contractor licence holder |
| Crew / Tenant | A single trade business; the multi-tenancy unit; up to 10 users per crew |
| DA | Development Application — a council planning notification used as a lead source |
| FSM | Field Service Management software (ServiceM8, Tradify) |
| OTP | One-Time Passcode — used for phone-number-based authentication |
| RLS | Row-Level Security — Supabase/Postgres per-tenant data isolation |
| AI worker | Background BullMQ job that calls Claude AI to generate the itemised quote |
| Rate card | The tradie's saved labour rates, margins, and cached supplier prices |
| Gold set | 50 labelled site photos with human-written quotes used in the promptfoo eval harness |
| p50 / p95 / p99 | 50th / 95th / 99th percentile latency |
| AUD / A$ | Australian Dollar |
| GST | Goods and Services Tax (Australia, 10%) |
| NSW | New South Wales, Australia |
| PWA | Progressive Web Application |
| EXIF | Exchangeable image file format — metadata embedded in phone photos (GPS, timestamp, device) |

### 1.4 References

1. `docs/00-tech-stack.md` — binding stack contract
2. `docs/01-market-analysis.md` — market analysis and competitor matrix
3. `docs/01b-product-spec.md` — product specification and user story map
4. `docs/01c-wedge.md` — wedge, differentiation axis, kill switches
5. NSW Home Building Act 1989 — statutory warranty wording
6. NSW Fair Trading — contractor licence requirements (residential work > A$5K)
7. Twilio AU long-code SMS documentation
8. Supabase RLS documentation
9. Claude API (Anthropic) — claude-opus-4-7 vision, claude-haiku-4-5 extraction

---

## 2. Overall Description

### 2.1 Product Perspective

QuotingAgent is a standalone PWA (hosted on Vercel, syd1 edge region) that integrates with:

- **Supabase** (auth, Postgres + pgvector, RLS, pgbouncer)
- **Anthropic API** (claude-opus-4-7 for vision quoting, claude-haiku-4-5 for extraction)
- **Twilio** (SMS delivery, AU long-code, delivery + read-receipt webhooks)
- **Service NSW REST API** (contractor licence number validation)
- **Bunnings / Reece** (live AU supplier pricing via scrape or PowerPass API)
- **ServiceM8 / Tradify** (OAuth REST push on quote acceptance)
- **GCS** (photo + PDF blob storage, EXIF preserved)
- **BullMQ + Upstash Redis** (async AI generation queue)
- **Resend** (email fallback delivery)
- **PostHog** (product analytics, feature flags)
- **Sentry** (error tracking)
- **DA aggregator** (existing product; fires webhooks to QuotingAgent)

The product does not replace FSM tools; it plugs into them. The mobile-first PWA is the primary UI surface (no desktop-first experience in V1).

### 2.2 Product Functions (Summary)

1. Phone-OTP onboarding with NSW contractor licence validation (one screen)
2. Lead triage tray (DA webhook ingest + manual entry)
3. Photo capture (PWA camera API, EXIF+GPS retained, GCS upload)
4. One-line optional context input
5. AI background quote generation (BullMQ worker, ≤ 60s, claude-opus-4-7 vision)
6. Review screen with confidence scores and tap-to-edit line items
7. SMS delivery (Twilio AU long-code) with read-receipt tracking
8. Customer one-tap acceptance (mobile web view, timestamped legal record)
9. Auto-follow-up SMS (D+3, D+7, per-lead disable)
10. FSM push (ServiceM8 / Tradify OAuth) on acceptance
11. Rate-card learning trigger after ≥ 5 completed jobs

### 2.3 User Classes and Characteristics

| Class | Description | Tech Proficiency | Primary Surface |
|---|---|---|---|
| **Crew Owner (primary)** | Owner-operator tradie (roofer, painter); buys subscription; generates and sends quotes | Medium — smartphone-native, allergic to enterprise UX | Mobile PWA (job-site, ute) |
| **Office Admin (supporting)** | Owner's spouse or admin assistant; manages lead ingest, monitors quote status | Medium-high | Mobile + tablet PWA |
| **Customer (external, unauthenticated)** | Homeowner receiving the quote link via SMS | Any | Mobile web (quote acceptance page) |
| **V2: Crew Member** | Employee using the app under the owner's subscription | Medium | [V2 — out of scope] |

### 2.4 Operating Environment

- **Runtime:** Node.js 22.x, TypeScript, Next.js 15 (App Router), React 19
- **Database:** Postgres 16 via Supabase (ap-southeast-2 / Sydney region); pgvector enabled
- **Queue:** BullMQ backed by Upstash Redis 7
- **Deploy:** Vercel (syd1 edge); GCS (ap-southeast-2) for blobs
- **Auth:** Supabase Auth, phone-OTP, JWT with refresh; argon2id for passwords
- **Primary client:** Mobile web (iOS Safari, Chrome for Android); PWA installable
- **Minimum iOS:** iOS 16 (WKWebView camera API support)
- **Minimum Android:** Android 12 (Chrome 108+)

### 2.5 Constraints

| Constraint | Detail |
|---|---|
| **Scale tier** | `preview` — single AU region; no Terraform; no Kubernetes; Vercel 10s function limit requires async AI generation via BullMQ |
| **AI cost** | ≤ A$0.30 per completed quote (measured at 100 quotes/day load) |
| **AI latency** | ≤ 20s wall-clock per LLM call; ≤ 60s total worker duration |
| **NSW regulatory** | Every quote sent for residential work > A$5K MUST include a validated NSW contractor licence number; statutory warranty wording (NSW Home Building Act) MUST be present |
| **Multi-tenancy** | RLS required; no cross-tenant data access; up to 10 users per crew |
| **PWA camera** | Must work on iOS Safari without App Store distribution; EXIF+GPS must be preserved |
| **SMS deliverability** | Twilio AU long-code only; must confirm delivery on Telstra and Optus before beta |
| **Timeline** | V1 MVP: 6–8 weeks from kick-off |
| **Team size** | Small team; no microservices; monolith wins |
| **Bunnings pricing** | Live price access via PowerPass API or scrape; scrape may be blocked — fallback to cached prices required |
| **Service NSW API** | Licence lookup must succeed before first quote is sent; if API is unavailable, block quote-send and show error |

---

## 3. Functional Requirements

> Priority scale: **Must-have** (V1 launch blocker), **Should-have** (V1 if effort allows, else V1.1), **Could-have** (V1.1+), **[V2]** (out-of-wedge).

---

### 3.1 Authentication & Onboarding

**FR-001 — Phone-OTP sign-up** [wedge-critical]

| Field | Value |
|---|---|
| Description | New users register using their mobile phone number. Supabase Auth sends an OTP via SMS. On verification, the user lands on the profile setup screen. |
| Priority | Must-have |
| Acceptance Criteria | (1) User enters AU mobile number; OTP is received within 30s on Telstra/Optus. (2) OTP verification succeeds in ≤ 2 attempts for a valid code. (3) On success, user is redirected to the profile setup screen (FR-002). (4) Invalid OTP shows inline error without page reload. (5) Rate-limited to 5 OTP attempts per number per hour. |

---

**FR-002 — Profile setup (one screen)** [wedge-critical]

| Field | Value |
|---|---|
| Description | After OTP verification, the user completes a single profile screen: business name, trade type, NSW contractor licence number (validated live), and default labour rate (pre-filled with industry median for the selected trade). |
| Priority | Must-have |
| Acceptance Criteria | (1) Profile screen contains exactly 4 fields: business name, trade type (dropdown: Roofer/Painter/Electrician/Plumber/Landscaper), NSW licence number, default labour rate ($/hr). (2) Tapping "Validate licence" calls Service NSW API; valid licence shows green tick; invalid or expired shows inline error. (3) User cannot proceed to the quote tray unless licence validation passes. (4) Default labour rate field pre-populates with industry median for selected trade. (5) Full onboarding (FR-001 + FR-002) completes in ≤ 60 seconds on a 4G connection. |

---

**FR-003 — Returning user sign-in** [wedge-critical]

| Field | Value |
|---|---|
| Description | Existing users sign in with phone-OTP and land directly on the Ready-to-Quote tray. |
| Priority | Must-have |
| Acceptance Criteria | (1) Returning user enters mobile number, receives OTP within 30s, and lands on the tray in ≤ 5s after OTP entry. (2) No profile setup screen is shown. (3) JWT refresh token extends the session without requiring re-authentication for 30 days. |

---

### 3.2 Lead Management

**FR-004 — Ready-to-Quote tray** [wedge-critical]

| Field | Value |
|---|---|
| Description | The home screen shows a single tray of all leads ready for quoting. Leads are ordered by recency (newest first). Each card shows: address, source (DA / manual / inbound SMS), received timestamp, and current status (New / Generating / Draft Ready / Sent / Opened / Won / Lost). |
| Priority | Must-have |
| Acceptance Criteria | (1) Tray renders within 1s of app open on a 4G connection. (2) Cards are sorted newest-first by default. (3) Empty state shows "No leads yet" copy and a "Add a lead manually" CTA. (4) Status badge on each card reflects real-time state (polling ≤ 5s interval or push notification on transition). (5) Tapping a card opens the lead detail screen (FR-005). |

---

**FR-005 — Lead detail screen** [wedge-critical]

| Field | Value |
|---|---|
| Description | The lead detail screen is the hub for a single lead. It shows attached photos, context note, AI draft (when ready), and all action CTAs. |
| Priority | Must-have |
| Acceptance Criteria | (1) Primary CTA ("Take photos" or "Generate quote") is ≥ 48px touch target. (2) Photo strip shows thumbnail + count of attached photos. (3) When a draft is ready, it is displayed inline (no navigation required). (4) Status transitions are reflected without full-page reload. |

---

**FR-006 — DA webhook lead ingest** [wedge-supporting]

| Field | Value |
|---|---|
| Description | The system exposes a webhook endpoint that the DA aggregator calls when a new development application is detected. A lead card is created in the crew's tray, pre-populated with address, DA description, council, and DA reference number. A push notification is sent to the crew owner. Duplicate DA reference numbers are silently discarded. |
| Priority | Should-have (V1 if DA webhook contract is confirmed; else V1.1) |
| Acceptance Criteria | (1) Webhook endpoint responds with HTTP 200 within 500ms of receiving a valid payload. (2) Lead card appears in tray within 2s of webhook receipt. (3) Push notification "New DA lead — [address]" fires within 5s. (4) A second webhook with the same DA reference number creates no duplicate card. (5) Malformed webhook payload returns HTTP 400 and is logged to Sentry. (6) Webhook is authenticated via HMAC-SHA256 shared secret. |

---

**FR-007 — Manual lead entry** [wedge-critical]

| Field | Value |
|---|---|
| Description | The crew owner can manually add a lead from a phone call or inbound SMS. Fields: customer name, mobile, address (Google Places AU autocomplete), job description. |
| Priority | Must-have |
| Acceptance Criteria | (1) Form accessible within 1 tap from the tray home screen. (2) Address field uses Google Places AU autocomplete. (3) Submitting the form creates a lead card in the tray within 1s. (4) Customer name and mobile are the only required fields; address and description are optional but shown. |

---

### 3.3 Photo Capture & Upload

**FR-008 — PWA camera capture** [wedge-critical]

| Field | Value |
|---|---|
| Description | From the lead detail screen, the user taps "Take photos" which opens the native device camera (not a file picker). Captured photos are immediately uploaded to GCS with EXIF and GPS metadata preserved. A thumbnail strip shows attached photos with a count. |
| Priority | Must-have |
| Acceptance Criteria | (1) Camera opens within 1 tap of the lead detail screen. (2) Each photo is uploaded to GCS within 5s of capture on a 4G connection. (3) EXIF metadata (GPS, timestamp, device) is preserved in GCS — verified by reading back metadata from a stored object. (4) Thumbnail strip updates within 1s of upload completion. (5) Tested on iPhone 14 iOS 17 (Safari) and Samsung Galaxy S23 (Chrome). (6) Supports up to 15 photos per lead. |

---

**FR-009 — Gallery photo upload** [wedge-critical]

| Field | Value |
|---|---|
| Description | The user can alternatively upload photos from their device camera roll. Up to 15 photos per lead. EXIF+GPS preserved. |
| Priority | Must-have |
| Acceptance Criteria | (1) "Upload from gallery" option visible on lead detail screen. (2) Multi-select supported (up to 15). (3) EXIF preserved as per FR-008. (4) Upload progress indicator shown per photo. |

---

### 3.4 AI Quote Generation

**FR-010 — One-line context input** [wedge-critical]

| Field | Value |
|---|---|
| Description | After photos are attached, the user can optionally type a short context note (max 280 chars). A placeholder example is shown. The AI generation proceeds without error if the field is left blank. |
| Priority | Must-have |
| Acceptance Criteria | (1) Field accepts up to 280 characters. (2) Placeholder reads "e.g. Re-roof, colorbond, single-storey, gutters too". (3) Tapping "Generate quote" with a blank context field proceeds to AI generation without error. (4) A disclaimer banner "No description added — AI will infer from photos only" appears when the field is blank and the user taps Generate. |

---

**FR-011 — Async AI quote generation** [wedge-critical]

| Field | Value |
|---|---|
| Description | Tapping "Generate quote" enqueues a BullMQ job. The AI worker calls claude-opus-4-7 (vision) with the uploaded photos, optional context, the crew's rate card, and cached Bunnings/Reece prices. On completion, the worker stores the draft quote and fires a push notification. The user can navigate away during generation. |
| Priority | Must-have |
| Acceptance Criteria | (1) BullMQ job is enqueued within 500ms of tapping "Generate quote". (2) Lead card status updates to "Generating..." immediately. (3) User can navigate to the tray and open other leads without interrupting generation. (4) Push notification "Quote draft ready" fires within 60s of enqueueing (p50 target). (5) Draft contains: materials line items (description, qty, unit, AU price), labour line items (description, hours, rate), subtotal, 10% GST, total (AUD), NSW licence number, statutory warranty wording, per-line confidence score (0–100%). (6) If the AI worker exceeds 60s, a partial draft is shown with a warning banner and below-threshold lines are auto-flagged. (7) Worker retries up to 2 times on transient API failure before marking the job as failed and notifying the user. |

---

**FR-012 — AI model selection and cost guard** [wedge-critical]

| Field | Value |
|---|---|
| Description | The worker uses claude-opus-4-7 for vision quoting and claude-haiku-4-5 for the structured extraction pass. If the estimated token cost for a quote exceeds A$0.30, the worker logs a cost-overrun warning and falls back to claude-sonnet-4-6 for the extraction pass. Per-quote token cost is logged to Sentry + Supabase. |
| Priority | Must-have |
| Acceptance Criteria | (1) Every completed quote record includes: model used, input tokens, output tokens, estimated cost (AUD). (2) If estimated cost > A$0.30, a `cost_overrun` event is logged and claude-sonnet-4-6 is used for extraction. (3) Mean AI cost per quote ≤ A$0.30 on a 20-quote load test. |

---

**FR-013 — AU rate-card data: Bunnings/Reece live pricing** [wedge-critical]

| Field | Value |
|---|---|
| Description | The AI worker fetches current AU supplier prices (Bunnings, Reece) via PowerPass API or scrape before generating the draft. If live pricing is unavailable, the worker uses the most recent cached prices (max 7 days old) and adds a "Prices may be outdated" banner to the draft. Rate-card data is stored in pgvector for embedding-based retrieval. |
| Priority | Must-have |
| Acceptance Criteria | (1) Live Bunnings prices are fetched for every quote generation attempt. (2) If the fetch fails, cached prices (≤ 7 days) are used and the "Prices may be outdated" banner is visible on the draft. (3) If cache is > 7 days old, the worker logs a `stale_rate_card` event and the banner is shown. (4) Rate-card embeddings are stored in pgvector in Supabase. (5) Rate-card cache refresh runs at least daily (BullMQ scheduled job). |

---

**FR-014 — Per-line confidence scores** [wedge-critical]

| Field | Value |
|---|---|
| Description | Every line item in the AI draft includes a confidence score (0–100%). Lines below 80% are auto-flagged. If more than 3 lines are below threshold, the primary CTA changes from "Looks good — send" to "Review flagged lines". |
| Priority | Must-have |
| Acceptance Criteria | (1) Every line item record has a `confidence_score` integer field (0–100). (2) Lines with confidence < 80 are highlighted in amber on the review screen. (3) A count banner "N lines need review" appears when ≥ 1 line is below threshold. (4) Primary CTA is "Review flagged lines" when ≥ 1 below-threshold line exists; "Looks good — send" when all lines ≥ 80%. (5) If overall quote confidence < 60% (> 3 unresolved flagged lines), tapping "Send anyway" shows a confirmation dialog requiring explicit confirmation "Send with low-confidence lines". |

---

### 3.5 Quote Review & Edit

**FR-015 — Tap-to-edit line items** [wedge-critical]

| Field | Value |
|---|---|
| Description | The tradie can tap any line item on the review screen to open an edit drawer. Editable fields: description, quantity, unit price. Totals (subtotal, GST, grand total) recalculate instantly. |
| Priority | Must-have |
| Acceptance Criteria | (1) Edit drawer opens within 300ms of tapping a line item. (2) Editing quantity or unit price triggers instant recalculation of subtotal, GST (10%), and total. (3) Edited values persist in the quote record immediately (no save button required — auto-save). (4) Draw closes on tap outside or swipe-down. |

---

**FR-016 — Quote PDF generation** [wedge-critical]

| Field | Value |
|---|---|
| Description | On tapping "Send", the system generates a PDF of the approved quote containing: line items, subtotal, GST (10%), total (AUD), business name, NSW contractor licence number, statutory warranty wording (NSW Home Building Act), quote date, quote reference number. The PDF is stored in GCS and accessible via a signed URL. |
| Priority | Must-have |
| Acceptance Criteria | (1) PDF is generated within 5s of tapping "Send". (2) PDF contains all required fields (licence number, GST line, statutory warranty wording). (3) PDF is stored in GCS with a signed URL expiring after 30 days. (4) PDF is accessible on mobile without download (renders inline in browser). |

---

### 3.6 SMS Delivery & Read Receipts

**FR-017 — SMS quote delivery (Twilio AU long-code)** [wedge-critical]

| Field | Value |
|---|---|
| Description | Tapping "Confirm send" dispatches an SMS to the customer via Twilio AU long-code containing a short message (≤ 160 chars) and a tap-link to the quote PDF view page. The tradie can edit the SMS body before sending. |
| Priority | Must-have |
| Acceptance Criteria | (1) SMS is dispatched within 3s of tapping "Confirm send". (2) SMS body is ≤ 160 characters and includes the signed quote link. (3) The tradie can edit the SMS body text (up to 160 chars) before confirming send. (4) SMS delivery confirmed on Telstra and Optus networks in AU before beta. (5) On Twilio delivery confirmation webhook, lead card status updates to "Delivered" with timestamp. |

---

**FR-018 — SMS read-receipt tracking** [wedge-critical]

| Field | Value |
|---|---|
| Description | When the customer taps the SMS link and the quote view page loads, a read event is recorded. The lead card status updates to "Opened" with timestamp. The tradie receives a push notification "Your quote was opened". |
| Priority | Must-have |
| Acceptance Criteria | (1) Quote view page fires a read-receipt event to the server on load (a simple GET to a tracking endpoint is sufficient). (2) Lead card status changes to "Opened" within 5s of the customer loading the page. (3) Push notification "Your quote was opened" is delivered to the tradie within 10s of the read event. |

---

**FR-019 — Email delivery fallback** [wedge-critical]

| Field | Value |
|---|---|
| Description | If the customer's mobile number is missing, or if Twilio returns a delivery failure, the system falls back to sending the quote via Resend email. The lead card notes "Sent by email (SMS failed)". |
| Priority | Must-have |
| Acceptance Criteria | (1) If mobile number is absent at send time, the fallback is automatic (no error shown to user). (2) If Twilio returns a delivery failure webhook, the email fallback is triggered within 30s. (3) Lead card shows "Sent by email (SMS failed)" status after fallback. |

---

### 3.7 Customer Quote Acceptance

**FR-020 — Customer quote view page (unauthenticated)** [wedge-critical]

| Field | Value |
|---|---|
| Description | The customer opens a mobile-optimised web page showing the full itemised quote: line items, total inc. GST, licence number, warranty clause, business name, and date. The page is accessible via the signed URL without authentication. |
| Priority | Must-have |
| Acceptance Criteria | (1) Quote page renders correctly on iOS Safari and Chrome for Android. (2) All required fields visible without scrolling on a 375px viewport. (3) Signed URL expires after 30 days. (4) Page loads within 2s on a 4G connection (Lighthouse performance ≥ 80). |

---

**FR-021 — One-tap quote acceptance** [wedge-critical]

| Field | Value |
|---|---|
| Description | A prominent "Accept Quote" button on the customer view page records: customer name (pre-filled from lead), timestamp, IP address, device type. The acceptance record is stored as a legally timestamped audit trail. The lead card updates to "Won" and the tradie receives a push notification. |
| Priority | Must-have |
| Acceptance Criteria | (1) "Accept Quote" CTA is ≥ 48px and visible above the fold on mobile. (2) Acceptance record stores: customer name, quote ID, timestamp (UTC), IP, user-agent. (3) Lead card status changes to "Won" within 5s of acceptance. (4) Push notification "Quote accepted — [customer name], [address]" delivered within 10s. (5) Acceptance is idempotent — tapping "Accept" a second time on the same quote does not create a duplicate record. |

---

**FR-022 — Customer quote decline** [wedge-supporting]

| Field | Value |
|---|---|
| Description | A "Decline" option on the customer view page records the decline with an optional free-text reason. The lead card updates to "Lost" and the tradie is notified. |
| Priority | Should-have |
| Acceptance Criteria | (1) Decline option visible on quote view page. (2) Free-text reason field is optional (max 280 chars). (3) Lead card status changes to "Lost" within 5s of decline. (4) Tradie receives push notification with decline reason if provided. |

---

### 3.8 Auto-Follow-Up

**FR-023 — D+3 and D+7 SMS follow-up** [wedge-supporting]

| Field | Value |
|---|---|
| Description | For any quote sent with no customer action (no acceptance, no decline) after 3 calendar days, an automated SMS nudge is sent: "Hi [name], just following up on the quote I sent for [address]. Any questions? — [tradie name]". A second nudge fires at D+7. The tradie can disable auto-follow-up per lead. |
| Priority | Should-have |
| Acceptance Criteria | (1) BullMQ scheduled job checks for no-response leads every hour. (2) D+3 SMS is sent between 08:00–18:00 AEST (not midnight). (3) D+7 SMS follows the same timing rule. (4) If the tradie taps "Disable auto-follow-up" on a lead, no nudge SMS is sent. (5) Lead card logs "Follow-up SMS sent D+3" / "D+7" after each nudge. (6) If the customer accepts or declines before D+3, no follow-up SMS is sent. |

---

### 3.9 NSW Compliance

**FR-024 — NSW contractor licence binding** [wedge-critical]

| Field | Value |
|---|---|
| Description | Every quote sent must include the crew's validated NSW contractor licence number. The "Send" button is locked unless `licence_verified = true` on the crew profile. The licence number appears on the PDF quote and in the quote view page. |
| Priority | Must-have |
| Acceptance Criteria | (1) The "Send" CTA is disabled (greyed out, aria-disabled) if `crew.licence_verified = false`. (2) Every PDF quote contains the licence number in the header. (3) Every quote view page shows the licence number. (4) 100% of quotes sent have `licence_verified = true` — verified by DB query on QA run. |

---

**FR-025 — NSW statutory warranty wording** [wedge-critical]

| Field | Value |
|---|---|
| Description | Every quote PDF and quote view page includes the statutory warranty wording required under the NSW Home Building Act. The wording is hardcoded (not user-editable) and reviewed by legal before production launch. |
| Priority | Must-have |
| Acceptance Criteria | (1) Statutory warranty text is present on every generated PDF. (2) Text is not editable by the tradie. (3) Legal sign-off on the exact wording is recorded as an ADR before first production quote is sent. |

---

**FR-026 — GST formatting** [wedge-critical]

| Field | Value |
|---|---|
| Description | Every quote includes an explicit GST line (10% of subtotal, AUD). The PDF and view page show: subtotal (ex GST), GST (10%), total (inc GST). |
| Priority | Must-have |
| Acceptance Criteria | (1) GST line is always present on quote PDF and view page. (2) GST is calculated as exactly 10% of subtotal, rounded to 2 decimal places. (3) Tradie cannot remove the GST line. |

---

### 3.10 FSM Integration

**FR-027 — ServiceM8 OAuth connection** [wedge-supporting]

| Field | Value |
|---|---|
| Description | The crew owner can connect their ServiceM8 account via OAuth from the settings screen. Once connected, every won quote automatically creates a job in ServiceM8 with customer details, quoted line items as job notes, quoted total as job value, and NSW licence number. |
| Priority | Should-have |
| Acceptance Criteria | (1) OAuth flow opens ServiceM8 auth in a bottom sheet / new tab; returns to QuotingAgent on success. (2) Connection status is shown in settings ("Connected as [ServiceM8 org name]"). (3) On quote acceptance, ServiceM8 job is created within 30s. (4) If ServiceM8 API call fails, the failure is logged to Sentry and a retry is queued (up to 3 attempts). (5) If no FSM is connected, a banner "Connect ServiceM8 to auto-create jobs" is shown after first acceptance. |

---

**FR-028 — Tradify OAuth connection and job push** [wedge-supporting]

| Field | Value |
|---|---|
| Description | Mirror of FR-027 for Tradify REST API. |
| Priority | Should-have |
| Acceptance Criteria | Mirror of FR-027, substituting Tradify API. |

---

### 3.11 Rate-Card Learning

**FR-029 — Job completion and invoiced amount capture** [wedge-supporting]

| Field | Value |
|---|---|
| Description | From a "Won" lead card, the tradie can tap "Mark as complete" and optionally enter the final invoiced amount. The system records: quoted vs. invoiced delta, materials used, trade type, job address. |
| Priority | Should-have |
| Acceptance Criteria | (1) "Mark as complete" CTA visible on Won lead cards. (2) Final invoiced amount field is optional. (3) On submission, a `job_completed` event is recorded with quoted_amount, invoiced_amount, trade_type. |

---

**FR-030 — Rate-card learning loop trigger** [wedge-supporting]

| Field | Value |
|---|---|
| Description | When a crew has ≥ 5 completed jobs with invoiced amounts recorded, subsequent AI quote generations incorporate the crew's historical margin data. A "Personalised to your rates" badge appears on the draft. |
| Priority | Should-have |
| Acceptance Criteria | (1) The AI worker queries the crew's completed job history before building the prompt. (2) When ≥ 5 completed jobs exist, the prompt includes a summary of the crew's actual margin delta and labour rates. (3) A "Personalised to your rates" badge is visible on drafts generated after the threshold is reached. |

---

### 3.12 AI Evaluation Harness

**FR-031 — promptfoo eval on gold set** [wedge-critical]

| Field | Value |
|---|---|
| Description | A 50-photo gold standard set with human-written quotes is maintained in the repo. A promptfoo eval suite runs in CI on every prompt or model change. The eval must report ≥ 80% line-item accuracy (within ±15% of human-written line-item values) to pass. |
| Priority | Must-have |
| Acceptance Criteria | (1) `pnpm eval` runs the promptfoo suite and exits 0 iff ≥ 80% accuracy on the gold set. (2) CI pipeline fails if accuracy drops below 80%. (3) Eval report includes per-photo breakdown and aggregate accuracy score. (4) Eval runs in < 10 minutes in CI (parallel photo processing). |

---

### 3.13 Notifications

**FR-032 — Push notifications** [wedge-critical]

| Field | Value |
|---|---|
| Description | The PWA uses the Web Push API to deliver notifications to the tradie for: (a) quote draft ready, (b) quote delivered (Twilio), (c) quote opened (read receipt), (d) quote accepted, (e) new DA lead. |
| Priority | Must-have |
| Acceptance Criteria | (1) Push permission prompt shown once, after first login. (2) Notification (a) fires within 60s of quote generation start. (3) Notifications (b)–(d) fire within 10s of the triggering event. (4) Notifications work on iOS Safari (iOS 16.4+ required for PWA push). (5) Tapping a notification deep-links to the relevant lead card. |

---

### 3.14 [Out-of-wedge → V2] Requirements

The following are explicitly deferred. They MUST NOT be built in V1.

| ID | Feature | Tag |
|---|---|---|
| FR-V2-001 | Invoicing and payment collection (Stripe) | [Out-of-wedge → V2] |
| FR-V2-002 | Job scheduling and dispatch | [Out-of-wedge → V2] |
| FR-V2-003 | Timesheets and crew tracking | [Out-of-wedge → V2] |
| FR-V2-004 | Customer CRM beyond accept/decline | [Out-of-wedge → V2] |
| FR-V2-005 | Multi-crew dispatch (crews > 10) | [Out-of-wedge → V2] |
| FR-V2-006 | Good/Better/Best tiered quotes | [Out-of-wedge → V2] |
| FR-V2-007 | Voice-memo input for job scope | [Out-of-wedge → V2] |
| FR-V2-008 | Commercial construction / blueprint takeoff | [Out-of-wedge → V2] |
| FR-V2-009 | Non-NSW state support (VIC, QLD, NZ) | [Out-of-wedge → V2] |
| FR-V2-010 | Native iOS / Android app | [Out-of-wedge → V2] |
| FR-V2-011 | Materials ordering / supplier integration beyond pricing | [Out-of-wedge → V2] |
| FR-V2-012 | Xero / MYOB sync | [Out-of-wedge → V2] |
| FR-V2-013 | AroFlo / Fergus / simPRO integrations | [Out-of-wedge → V2] |
| FR-V2-014 | Crew-member accounts (multi-user per tenant) | [Out-of-wedge → V2] |
| FR-V2-015 | Suburb-level pricing heat maps | [Out-of-wedge → V2] |
| FR-V2-016 | Deposit invoice on acceptance | [Out-of-wedge → V2] |

---

## 4. Non-Functional Requirements

### 4.1 Performance

**NFR-001 — Photo-to-SMS end-to-end latency** [wedge-critical]

| Metric | Target |
|---|---|
| p50 (photo uploaded → SMS delivered) | ≤ 5 minutes |
| p95 (photo uploaded → SMS delivered) | ≤ 10 minutes |
| Measurement | Server-side event log: `photo_uploaded` → `sms_delivered` timestamps |
| Test | Load test: 50 concurrent quote generations in k6; measure p50/p95 |

---

**NFR-002 — AI generation queue latency** [wedge-critical]

| Metric | Target |
|---|---|
| p50 (BullMQ enqueue → push notification) | ≤ 60 seconds |
| p95 (BullMQ enqueue → push notification) | ≤ 90 seconds |
| Single LLM call wall-clock budget | ≤ 20 seconds |
| Measurement | BullMQ job timestamps: `started_at` → `completed_at`; Sentry performance traces |
| Test | Run 20 concurrent quote generation jobs; assert p50 ≤ 60s, p95 ≤ 90s |

---

**NFR-003 — API route response times** [wedge-critical]

| Endpoint class | p95 target |
|---|---|
| Auth (OTP send / verify) | ≤ 500ms |
| Lead CRUD (create, list, update) | ≤ 200ms |
| Webhook ingest (DA, Twilio) | ≤ 500ms |
| Quote send | ≤ 3s (includes Twilio SMS dispatch) |
| Customer quote view page (SSR) | ≤ 2s TTFB |
| Measurement | Vercel analytics + Sentry performance; k6 load test |

---

**NFR-004 — PWA load performance** [wedge-critical]

| Metric | Target |
|---|---|
| Lighthouse Performance score (mobile) | ≥ 80 |
| First Contentful Paint (4G) | ≤ 2s |
| Time to Interactive (4G) | ≤ 3s |
| Measurement | Lighthouse CI in Buildkite pipeline on every PR |

---

**NFR-005 — AI cost per quote** [wedge-critical]

| Metric | Target |
|---|---|
| Mean AI cost per completed quote | ≤ A$0.30 |
| Max AI cost per completed quote (hard cap) | A$0.50 (triggers fallback model) |
| Measurement | Per-quote cost logged to `quote_ai_cost` table in Supabase; Sentry alert if mean > A$0.30 over 10-quote rolling window |
| Test | 20-quote load test; assert mean cost ≤ A$0.30 |

---

**NFR-006 — AI line-item accuracy** [wedge-critical]

| Metric | Target |
|---|---|
| Line-item accuracy on 50-photo gold set | ≥ 80% (within ±15% of human-written value per line) |
| CI gate | promptfoo eval exits non-zero if < 80%; blocks merge |
| Kill switch | If < 80% after 8 weeks → reduce scope (see docs/01c-wedge.md §5.2) |

---

**NFR-007 — SMS deliverability** [wedge-critical]

| Metric | Target |
|---|---|
| SMS delivery rate (Twilio AU long-code) | ≥ 98% on Telstra + Optus networks |
| SMS open rate (link tapped) | ≥ 70% (30-day) |
| Measurement | Twilio delivery webhook events; `sms_delivered` / `sms_failed` per quote |

---

### 4.2 Scalability

**NFR-008 — Preview-tier concurrency** [wedge-supporting]

| Metric | Target |
|---|---|
| Concurrent quote generation jobs (BullMQ) | ≥ 20 simultaneous without p95 exceeding NFR-002 |
| Database connections | Supabase pgbouncer pool; max 20 active connections per worker instance |
| Scale-up trigger | Re-evaluate at 200 paying crews or A$300K ARR |
| Note | Vercel serverless functions auto-scale; BullMQ worker scaled by Upstash Redis queue depth |

---

**NFR-009 — Multi-tenant data isolation** [wedge-critical]

| Metric | Target |
|---|---|
| RLS coverage | 100% of tables containing crew data must have RLS policies enforcing crew_id ownership |
| Cross-tenant query | Zero rows returned in cross-tenant query test (automated penetration test before beta) |
| Test | `scripts/test-rls.sh` runs 50 cross-tenant query attempts; asserts 0 rows returned |

---

### 4.3 Security

**NFR-010 — Authentication security** [wedge-critical]

| Requirement | Detail |
|---|---|
| Password hashing | argon2id (no bcrypt) |
| OTP rate limiting | 5 attempts per number per hour; 10 per day |
| JWT refresh | Refresh token rotates on every use; 30-day lifetime |
| Session revocation | All sessions revocable per user from Supabase Auth admin |

---

**NFR-011 — HTTPS and CSP** [wedge-critical]

| Requirement | Detail |
|---|---|
| Transport | HTTPS everywhere; HSTS header required |
| Content Security Policy | CSP header on all Next.js responses; `script-src 'self'` + allowlisted CDN domains only |
| Secrets management | All secrets in GCP Secret Manager; no secrets in env files committed to repo |
| Signed URLs | GCS signed URLs expire ≤ 30 days; re-generated on access |

---

**NFR-012 — Rate limiting** [wedge-critical]

| Endpoint | Limit |
|---|---|
| OTP send | 5/hr per phone number |
| Quote generation | 100/day per crew |
| Webhook ingest (DA, Twilio) | 1000/min per IP (DDoS guard) |
| Implementation | Upstash Redis sliding-window rate limiter on Next.js middleware |

---

**NFR-013 — Data privacy** [wedge-supporting]

| Requirement | Detail |
|---|---|
| PII in logs | No customer names, mobile numbers, or addresses in application logs (Pino structured log redaction) |
| GCS photo retention | Photos retained for 2 years; deletion on crew account cancellation |
| Audit trail | Quote acceptance records (FR-021) retained for 7 years (NSW building contract statute of limitations) |
| Analytics consent | PostHog loads only after user consent (consent banner on first load) |

---

### 4.4 Availability & Reliability

**NFR-014 — Service availability** [wedge-supporting]

| Metric | Target |
|---|---|
| Uptime (preview tier) | ≥ 99.0% monthly (Vercel SLA: 99.99%; Supabase free tier: best-effort) |
| AI worker availability | BullMQ jobs are persisted in Upstash Redis; jobs survive worker restarts |
| Queue durability | Upstash Redis persistence enabled; failed jobs retry up to 3× with exponential backoff |
| Note | Preview tier does not require a formal SLA; re-evaluate at launch tier |

---

**NFR-015 — Error tracking and alerting** [wedge-supporting]

| Requirement | Detail |
|---|---|
| Error tracking | Sentry free tier; all unhandled exceptions captured with crew context (no PII) |
| AI cost alert | Sentry alert if rolling 10-quote mean cost > A$0.30 |
| Failed quote alert | Sentry alert if BullMQ job fails after 3 retries |
| SMS failure alert | Sentry alert if Twilio delivery failure rate > 2% in any 1-hour window |

---

### 4.5 Maintainability

**NFR-016 — Code quality gates** [wedge-supporting]

| Gate | Tool | Threshold |
|---|---|---|
| TypeScript typecheck | tsc --noEmit | 0 errors |
| Lint | ESLint (Next.js ruleset) | 0 errors; warnings allowed |
| Unit tests | Vitest | ≥ 80% branch coverage on AI worker, quote calculation, RLS helpers |
| Mutation testing | Stryker | Mutation score ≥ 60% on quote calculation logic |
| Integration tests | Vitest + Supabase local | Quote CRUD, RLS, BullMQ job lifecycle |
| E2E tests | Playwright | All CF-1 through CF-8 scenarios pass |
| AI eval | promptfoo | ≥ 80% line-item accuracy on 50-photo gold set |
| Performance | Lighthouse CI | ≥ 80 mobile score |

---

**NFR-017 — Observability** [wedge-supporting]

| Requirement | Detail |
|---|---|
| Structured logging | Pino; JSON format; log level configurable via env |
| Request tracing | Sentry performance traces on all API routes |
| AI token metrics | Per-quote: model, input_tokens, output_tokens, cost_aud stored in `quote_ai_usage` table |
| BullMQ job metrics | Job start/complete/fail events logged; job duration tracked |

---

**NFR-018 — Deployment and rollback** [wedge-supporting]

| Requirement | Detail |
|---|---|
| CI/CD | Buildkite pipeline; all gates (NFR-016) must pass before deploy |
| Preview deploys | Every PR gets a Vercel preview URL |
| Rollback | Vercel instant rollback to previous deployment via dashboard |
| DB migrations | Prisma migrate deploy in CI; migration files committed to repo |

---

### 4.6 Compliance

**NFR-019 — NSW contractor licence compliance** [wedge-critical]

| Requirement | Detail |
|---|---|
| Licence validation | Every new crew validated against Service NSW REST API at onboarding |
| Quote-send lock | Quote send is blocked if `crew.licence_verified = false` |
| Licence on every quote | 100% of sent quotes must include the verified licence number (see FR-024) |
| Statutory warranty | NSW Home Building Act wording on every quote > A$5K (see FR-025) |
| Legal review | Exact warranty wording must be signed off by legal counsel before first production quote |

---

**NFR-020 — GST compliance** [wedge-critical]

| Requirement | Detail |
|---|---|
| GST line | Required on every quote; 10% of subtotal; AUD; 2 decimal places |
| ABN display | Crew ABN displayed on quote PDF (captured at onboarding) |
| Tax invoice format | Quotes > A$82.50 inc GST are formatted as tax invoices per ATO requirements |

---

**NFR-021 — AU data residency** [wedge-supporting]

| Requirement | Detail |
|---|---|
| Data region | All Supabase data in ap-southeast-2 (AWS Sydney); GCS bucket in asia-southeast2 or australia-southeast1 |
| AI API | Anthropic API calls may exit AU; no PII in prompts (photos only + anonymised job description) |
| SMS | Twilio AU long-code; data processed via Twilio AU endpoints where available |

---

## 5. Use Cases

### UC-001 — First-time tradie onboarding

| Field | Value |
|---|---|
| ID | UC-001 |
| Actor | Crew Owner (new user) |
| Precondition | User has not previously signed up; has a current NSW contractor licence |
| Main Flow | 1. User enters AU mobile number. 2. System sends OTP via Supabase Auth SMS. 3. User enters OTP. 4. System verifies OTP and creates user + crew record. 5. Profile setup screen shown. 6. User enters business name, trade type, NSW licence number, default labour rate. 7. System calls Service NSW API to validate licence. 8. Licence valid → user lands on Ready-to-Quote tray. |
| Alternative Flow A | Step 7: Licence invalid → inline error; user corrects and retries. |
| Alternative Flow B | Step 3: Wrong OTP → inline error; up to 5 attempts. |
| Postcondition | `crew.licence_verified = true`; user on tray screen; onboarding completed in ≤ 60s |

---

### UC-002 — Manual quote generation (critical flow)

| Field | Value |
|---|---|
| ID | UC-002 |
| Actor | Crew Owner |
| Precondition | User is authenticated; crew profile complete; ≥ 1 photo attached to a lead |
| Main Flow | 1. User opens lead card. 2. User taps "Take photos" or "Upload from gallery"; attaches 4–10 photos. 3. (Optional) User types one-line context. 4. User taps "Generate quote". 5. BullMQ job enqueued; status → "Generating...". 6. AI worker fetches Bunnings prices, calls claude-opus-4-7 (vision) + claude-haiku-4-5 (extraction). 7. Draft ready push notification fired (≤ 60s). 8. User reviews draft; all lines ≥ 80% confidence. 9. User taps "Looks good — send". 10. PDF generated; SMS dispatched via Twilio. 11. Lead status → "Delivered". |
| Alternative Flow A | Step 8: Lines below 80% → amber flags; user edits or confirms "Send with low-confidence lines". |
| Alternative Flow B | Step 10: Twilio failure → email fallback via Resend. |
| Postcondition | Customer receives SMS with quote link; lead card status = "Delivered"; cost ≤ A$0.30 |

---

### UC-003 — Customer accepts quote

| Field | Value |
|---|---|
| ID | UC-003 |
| Actor | Customer (homeowner), Crew Owner |
| Precondition | Quote sent; customer has the SMS link |
| Main Flow | 1. Customer opens SMS link. 2. Quote view page loads (read event fires). 3. Lead card → "Opened"; push notification to tradie. 4. Customer taps "Accept Quote". 5. Acceptance record created (timestamp, IP, user-agent). 6. Lead card → "Won". 7. Push notification "Quote accepted" to tradie. 8. If FSM connected: job created in ServiceM8/Tradify within 30s. |
| Alternative Flow A | Customer taps "Decline" → lead → "Lost"; tradie notified with optional reason. |
| Postcondition | Legally timestamped acceptance record stored; FSM job created (if connected) |

---

### UC-004 — DA lead ingest and auto-quote trigger

| Field | Value |
|---|---|
| ID | UC-004 |
| Actor | DA Aggregator (external system), Office Admin |
| Precondition | DA aggregator webhook configured; crew has at least one owner with a validated licence |
| Main Flow | 1. DA aggregator fires webhook to `/api/webhooks/da-lead`. 2. System validates HMAC-SHA256 signature. 3. Deduplication check on DA reference number. 4. New lead card created in crew tray. 5. Push notification "New DA lead — [address]" sent to crew owner. |
| Alternative Flow A | Duplicate DA reference → silently discarded. |
| Alternative Flow B | Malformed payload → HTTP 400; logged to Sentry. |
| Postcondition | Lead card in tray; crew owner notified within 5s |

---

### UC-005 — Rate-card learning feedback

| Field | Value |
|---|---|
| ID | UC-005 |
| Actor | Crew Owner |
| Precondition | Lead status = "Won" |
| Main Flow | 1. Tradie taps "Mark as complete" on a Won lead card. 2. Modal asks for final invoiced amount (optional). 3. On submit, `job_completed` record created. 4. If crew now has ≥ 5 completed jobs with invoiced amounts, rate-card learning is activated for future quotes. |
| Postcondition | `job_completed` record stored; learning threshold checked |

---

## 6. Data Requirements

### Core Entities

**Crew** (tenant unit)
- `id` UUID PK
- `business_name` text
- `trade_type` enum (roofer | painter | electrician | plumber | landscaper)
- `nsw_licence_number` text
- `licence_verified` boolean (default false)
- `licence_verified_at` timestamptz
- `default_labour_rate_aud` numeric(10,2)
- `abn` text
- `created_at` timestamptz
- RLS: all operations scoped to authenticated user's `crew_id`

**User** (crew member — V1: owner only)
- `id` UUID PK (= Supabase Auth user id)
- `crew_id` UUID FK → Crew
- `phone` text (E.164)
- `role` enum (owner | member) — V1 owner only
- `created_at` timestamptz

**Lead**
- `id` UUID PK
- `crew_id` UUID FK → Crew (RLS)
- `source` enum (da | manual | inbound_sms)
- `da_reference` text nullable (unique per crew)
- `customer_name` text
- `customer_mobile` text (E.164, nullable)
- `customer_email` text nullable
- `address` text
- `description` text nullable (max 280 chars)
- `status` enum (new | generating | draft_ready | sent | delivered | opened | won | lost)
- `sms_disabled_followup` boolean default false
- `created_at` timestamptz
- `updated_at` timestamptz

**Photo**
- `id` UUID PK
- `lead_id` UUID FK → Lead (RLS via lead.crew_id)
- `gcs_path` text
- `exif_data` jsonb (GPS lat/lng, timestamp, device)
- `uploaded_at` timestamptz

**Quote**
- `id` UUID PK
- `lead_id` UUID FK → Lead (RLS via lead.crew_id)
- `crew_id` UUID FK → Crew
- `status` enum (draft | approved | sent | accepted | declined)
- `line_items` jsonb (array of {description, qty, unit, unit_price_aud, confidence_score})
- `subtotal_aud` numeric(12,2)
- `gst_aud` numeric(12,2)
- `total_aud` numeric(12,2)
- `licence_number` text (snapshot at send time)
- `licence_verified` boolean
- `statutory_warranty_text` text (snapshot at send time)
- `pdf_gcs_path` text nullable
- `pdf_signed_url` text nullable
- `pdf_signed_url_expires_at` timestamptz nullable
- `ai_model_vision` text
- `ai_model_extraction` text
- `ai_input_tokens` integer
- `ai_output_tokens` integer
- `ai_cost_aud` numeric(8,4)
- `rate_card_source` enum (live | cached | learned)
- `created_at` timestamptz
- `sent_at` timestamptz nullable

**QuoteAcceptance** (legal audit trail)
- `id` UUID PK
- `quote_id` UUID FK → Quote
- `accepted_at` timestamptz
- `ip_address` inet
- `user_agent` text
- `customer_name` text (snapshot)
- `retention_until` date (7 years from accepted_at)

**SmsEvent**
- `id` UUID PK
- `quote_id` UUID FK → Quote
- `twilio_message_sid` text
- `event_type` enum (sent | delivered | failed | opened)
- `occurred_at` timestamptz

**JobCompletion** (rate-card learning)
- `id` UUID PK
- `lead_id` UUID FK → Lead
- `crew_id` UUID FK → Crew
- `quoted_amount_aud` numeric(12,2)
- `invoiced_amount_aud` numeric(12,2) nullable
- `trade_type` enum
- `completed_at` timestamptz

---

## 7. External Interface Requirements

### 7.1 User Interfaces

- **Primary surface:** Mobile-first PWA (Next.js 15, Tailwind 4, shadcn-ui)
- **Responsive priority:** 375px–430px viewport (iPhone SE to iPhone 15 Pro Max) is the design baseline; desktop supported but not optimised
- **PWA manifest:** Installable; standalone display mode; camera access via `getUserMedia` / `<input type="file" capture>`
- **Touch targets:** All interactive elements ≥ 48×48px
- **Typography:** System font stack; minimum 16px body text
- **Dark mode:** Not required in V1
- **Accessibility:** WCAG 2.1 AA for all critical-flow screens; tested with axe-core in E2E suite

### 7.2 API Interfaces

All API routes are Next.js App Router Route Handlers (TypeScript). Request/response schemas validated with Zod. Auth via Supabase JWT (Bearer token in Authorization header).

Key routes:

| Route | Method | Auth | Description |
|---|---|---|---|
| `/api/leads` | GET | Crew member | List leads for authenticated crew |
| `/api/leads` | POST | Crew member | Create manual lead |
| `/api/leads/[id]` | PATCH | Crew member | Update lead (status, description) |
| `/api/leads/[id]/photos` | POST | Crew member | Upload photos to lead |
| `/api/leads/[id]/quote` | POST | Crew member | Enqueue AI quote generation |
| `/api/leads/[id]/quote` | GET | Crew member | Get latest quote draft for lead |
| `/api/leads/[id]/quote/send` | POST | Crew member | Approve and send quote by SMS |
| `/api/quotes/[id]/view` | GET | Public (signed URL) | Customer quote view page |
| `/api/quotes/[id]/accept` | POST | Public | Customer one-tap acceptance |
| `/api/quotes/[id]/decline` | POST | Public | Customer decline |
| `/api/webhooks/da-lead` | POST | HMAC-SHA256 | DA aggregator lead ingest |
| `/api/webhooks/twilio/delivery` | POST | Twilio signature | SMS delivery status update |
| `/api/webhooks/twilio/read` | GET | Open (tracking pixel equiv.) | SMS link open / read receipt |
| `/api/auth/onboarding` | POST | Supabase JWT | Save crew profile after OTP |
| `/api/crew/licence-validate` | POST | Crew member | Re-validate licence against Service NSW |

### 7.3 Third-Party Integrations

| Integration | Purpose | Protocol | Auth |
|---|---|---|---|
| **Supabase Auth** | Phone-OTP authentication, JWT session management | Supabase JS SDK | Built-in |
| **Supabase Postgres** | Primary database + RLS + pgvector | Prisma ORM (connection pooler: pgbouncer) | Service role key (server-side only) |
| **Anthropic API** | AI quote generation (claude-opus-4-7, claude-haiku-4-5, fallback claude-sonnet-4-6) | REST / Anthropic SDK | ANTHROPIC_API_KEY (GCP Secret Manager) |
| **Twilio** | SMS delivery (AU long-code), delivery webhooks, read-receipt webhooks | Twilio REST API + Node SDK | TWILIO_ACCOUNT_SID + AUTH_TOKEN |
| **Service NSW REST API** | Contractor licence number validation | REST | NSW API key |
| **GCS (Google Cloud Storage)** | Photo uploads, PDF storage | GCS Node SDK + signed URLs | GCP service account |
| **BullMQ + Upstash Redis** | Async AI generation queue; scheduled follow-up jobs | BullMQ + ioredis | UPSTASH_REDIS_URL + token |
| **Resend** | Email fallback delivery | Resend Node SDK | RESEND_API_KEY |
| **PostHog** | Product analytics, feature flags | PostHog JS SDK (consent-gated) | POSTHOG_API_KEY |
| **Sentry** | Error tracking, performance, cost alerts | Sentry Next.js SDK | SENTRY_DSN |
| **Bunnings / Reece** | Live AU supplier pricing | Scrape or PowerPass API | Bunnings PowerPass credentials |
| **ServiceM8** | Won-job push | ServiceM8 REST API | OAuth 2.0 per crew |
| **Tradify** | Won-job push | Tradify REST API | OAuth 2.0 per crew |
| **Google Places AU** | Address autocomplete (manual lead entry) | Maps JS API | GOOGLE_PLACES_API_KEY |
| **Buildkite** | CI/CD pipeline | Buildkite REST + BK Agent | BK_API_TOKEN |
| **Vercel** | Hosting (syd1 edge) | Vercel CLI / GitHub integration | VERCEL_TOKEN |

---

## 8. Assumptions and Dependencies

| ID | Type | Statement | Risk if Wrong | Validation |
|---|---|---|---|---|
| A1 | Technical | Claude Opus-4-7 vision achieves ≥ 80% line-item accuracy on AU residential roofing/painting photos | Core wedge fails; scope reduction required | promptfoo gold-set eval in week 2 of build |
| A2 | Technical | Twilio AU long-code SMS delivers reliably (≥ 98%) to Telstra/Optus/Vodafone | SMS-first delivery fails; fall back to email-first UX | 100-SMS carrier test in week 1 |
| A3 | External | Service NSW contractor licence lookup API is available and returns reliable status | Fallback to manual entry + periodic batch validation | API access test in week 1 |
| A4 | External | Bunnings live pricing accessible (PowerPass API or scrape) | Rate-card degrades to cached/stale; accuracy impact | Bunnings access test + PowerPass partnership contact in week 1 |
| A5 | Technical | PWA camera API on iOS Safari (WKWebView, iOS 16+) provides photo quality sufficient for AI vision | Native iOS wrapper required (App Store delay) | iPhone 14 iOS 17 test in week 1 |
| A6 | UX | Tradies will review AI draft and not override everything | Quote review UX abandoned after 2 uses | Beta test with 3 roofers in week 4; measure edit-per-draft |
| A7 | Market | A$99/mo per crew is within ICP budget tolerance | Reprice or add commission alternative | 50 in-person interviews before month-end |
| A8 | External | DA aggregator webhook can be plumbed in within V1 timeline | SF1-1 ships as V1.1 | DA aggregator API contract in week 1 |
| A9 | Security | Supabase RLS correctly isolates per-crew data under concurrent load | Data leak between tenants — critical | Penetration test before beta |
| A10 | Unit economics | AI quote cost remains ≤ A$0.30 at 100 quotes/day | Unit economics break | 100-concurrent-quote load test in week 6 |
| A11 | Legal | NSW Home Building Act statutory warranty wording can be confirmed and hardcoded | Non-compliant quotes; legal liability | Legal review in week 2 |
| A12 | External | ServiceM8 OAuth partner app approval timeline ≤ V1 timeline | FSM integration ships as V1.1 | Partner application submitted in week 1 |
| D1 | Dependency | `BK_API_TOKEN` and `BUILDKITE_ORG` provisioned in env | CI/CD pipeline blocked | Confirmed in tech-stack contract |
| D2 | Dependency | `PROJECT_ID=sunlit-core-205604` (GCP) active; GCS bucket created in AU region | Photo/PDF storage unavailable | Confirmed in tech-stack contract |
| D3 | Dependency | 50-photo gold standard set with human-written quotes exists or will be created in week 1 | AI eval harness cannot run | Beta roofer recruitment (FR-031) |
| D4 | Dependency | Supabase project provisioned in ap-southeast-2 with pgvector extension enabled | Database unavailable | Week 1 infra task |

---

## Appendix A — Requirements Count Summary

| Tag | FR Count |
|---|---|
| [wedge-critical] | 19 |
| [wedge-supporting] | 9 |
| [Out-of-wedge → V2] | 16 |
| **Total FRs** | **44** |

| Category | NFR Count |
|---|---|
| Performance (NFR-001–007) | 7 |
| Scalability (NFR-008–009) | 2 |
| Security (NFR-010–013) | 4 |
| Availability & Reliability (NFR-014–015) | 2 |
| Maintainability (NFR-016–017) | 2 |
| Compliance (NFR-018–021) | 4 |
| **Total NFRs** | **21** |

---

## Appendix B — Open Issues

> These must be resolved before the V1 backend-developer and frontend-developer phases begin. They block specific FRs.

| # | Issue | Blocks | Owner |
|---|---|---|---|
| OI-001 | **NSW statutory warranty exact wording** — legal review required before hardcoding in FR-025 | FR-025, NFR-019 | Legal counsel |
| OI-002 | **DA aggregator webhook contract** — is the DA aggregator ready to fire webhooks? Blocks SF1-1 MVP vs V1.1 | FR-006 | DA aggregator team |
| OI-003 | **Bunnings PowerPass API access** — has a formal API arrangement or scrape strategy been decided? | FR-013 | Business dev |
| OI-004 | **50-photo gold standard set** — do 50 labelled examples from real roofers exist? | FR-031 | Beta roofer recruiting |
| OI-005 | **ServiceM8 OAuth partner application** — has it been submitted? Timeline? | FR-027 | Business dev |
| OI-006 | **A$99/mo vs 3% commission** — should both be offered at V1 or subscription-only first? | NFR-020, pricing skill | CEO |
| OI-007 | **ABN collection at onboarding** — required for tax invoice format compliance (NFR-020); not currently in FR-002 | FR-002, NFR-020 | Analyst |

---

*Document end. Critic gate: not required for analyst phase (critic_required: false). Next phase: designer.*
