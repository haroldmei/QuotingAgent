# Product Specification — QuotingAgent (Western Sydney AI Quoting)

<!-- WEDGE: For 1–10 staff Western Sydney trade owners, a site photo becomes an SMS-sent, AU-priced, NSW-licence-bound quote in under 5 minutes. -->

> Version: 1.0 — 2026-05-01
> Phase: product-spec (build-product-v2 pipeline)
> Scale tier: preview
> ICP: Owner-operator residential roofer/painter, Western Sydney, 1–10 staff, NSW contractor licence holder

---

## 1. Vision Statement

QuotingAgent is the fastest way for a Western Sydney residential trade owner to turn a job-site photo into a won job. The product collapses a 24–72 hour, 2–4 hour owner-effort quoting process into a single 5-minute mobile workflow: snap photos on site, receive an AI-generated itemised quote priced from current Bunnings/Reece rates and the tradie's own historical margins, review in one tap, and deliver to the customer by SMS with a read receipt and one-tap acceptance link — all with the tradie's NSW Fair Trading contractor licence number and statutory warranty wording bound to every quote by default. The product earns its keep when the customer's "accepted" notification arrives before the tradie has driven to the next job.

---

## 2. User Personas

### Persona 1 — "Roofer Rob" (Primary ICP — Critical Flow)

| Attribute | Detail |
|---|---|
| Name | Rob Nguyen |
| Role | Owner-operator, residential roofing, Penrith |
| Age | 38 |
| Team size | 3 (Rob + 2 labourers) |
| Annual revenue | A$850K |
| Tech | iPhone 14, uses ServiceM8, has Bunnings PowerPass |
| Licence | NSW Contractor Licence (Roof Plumbing), current |
| Quotes/week | 12–18; wins ~40%; loses 6–7/wk to slow response |

**Goals:** Win more jobs without working later evenings. Quote from the ute, not the kitchen table at 9pm.

**Pain points:** (1) Looks up Bunnings prices every quote — they change every few weeks. (2) Typing the same line items for the 200th time. (3) Emails quotes that sit unread for 2–3 days; no visibility. (4) Forgot to include his licence number on two quotes last year — got a formal warning.

**Quote:** *"I lose jobs to blokes who just quote cheaper and faster. I'm not cheaper but I can definitely be faster."*

**Tech proficiency:** Medium. Comfortable with apps; uses ServiceM8 daily; allergic to anything that requires a desktop or a manual.

---

### Persona 2 — "Painter Pete" (Primary ICP — Supporting flow user)

| Attribute | Detail |
|---|---|
| Name | Pete Castillo |
| Role | Owner-operator, residential painting, Blacktown |
| Age | 44 |
| Team size | 2 (Pete + 1 apprentice) |
| Annual revenue | A$420K |
| Tech | Samsung Galaxy S23, uses Tradify, manual Excel quotes |
| Licence | NSW Contractor Licence (General), current |
| Quotes/week | 8–12; wins ~35% |

**Goals:** Spend less time quoting, more time on the tools. His wife handles admin on weekends — she shouldn't have to.

**Pain points:** (1) Quote turnaround is 36–48h — by then the homeowner has heard from two other painters. (2) Excel template breaks when he adds new line items. (3) No follow-up system; leads go cold after 1 week. (4) Has never successfully integrated quoting into Tradify — still uses a Word doc.

**Quote:** *"By the time I've typed it all out and sent the PDF, they've already hired someone else."*

**Tech proficiency:** Low-medium. Smartphone-native but avoids "complicated" software. Prefers things that work like texting.

---

### Persona 3 — "DA Dispatcher Dana" (Supporting flow — DA lead ingestion)

| Attribute | Detail |
|---|---|
| Name | Dana Okafor |
| Role | Owner's spouse / office manager, roofing business, Parramatta |
| Age | 35 |
| Team size | Manages admin for a 5-person crew |
| Annual revenue | A$1.2M (the business) |
| Tech | iPad + iPhone, uses ServiceM8 for scheduling |
| Quotes/week | Processes 20–25 leads; Rob quotes ~15 of them |

**Goals:** Get leads routed to the right crew member instantly. Stop losing DA notifications in the email flood. Have a paper trail for every quote sent.

**Pain points:** (1) DA notifications arrive by email; she has to manually copy details into ServiceM8. (2) No way to know if a lead was followed up. (3) Quote PDFs live in a Gmail thread — no central record. (4) Read receipts would let her chase customers before they go cold.

**Quote:** *"I can see 15 new DAs in my inbox this morning. Rob won't see them until tonight."*

**Tech proficiency:** Medium-high. Comfortable with business software; manages multiple apps; wants automation not more manual steps.

---

### Persona 4 — "Sparkie Sam" [V2 — Electricians targeted Months 3–9]

| Attribute | Detail |
|---|---|
| Name | Sam Tran |
| Role | Owner-operator, residential electrician, Blacktown |
| Age | 31 |
| Team size | 1 (sole trader) |
| Annual revenue | A$280K |
| Tech | iPhone 15 Pro, no FSM (uses Notes app + Google Calendar) |
| Licence | NSW Electrical Contractor Licence |
| Quotes/week | 5–8 (specialist work; >$1 quoting requirement regardless of value) |

**Goals:** Get off Google Calendar and Notes. Win bigger jobs — currently quoting too low because he can't estimate quickly.

**Pain points:** (1) Specialist work requires quoting every job regardless of value — even a $300 job needs a written quote. (2) No rate-card discipline; re-invents pricing every time. (3) Not yet using ServiceM8 — no integration requirement today.

**Quote:** *"I just want to tap a few photos and get back a real price. I don't need a whole business system."*

**Tech proficiency:** High. Early adopter, comfortable with new apps.

**Note:** Sam is the V2 expansion persona. The critical flow and all V1 supporting flows are built for Rob and Pete first; Sam's solo-trader, no-FSM workflow is a V1.1 target.

---

## 3. User Story Map

### Critical Flow — Photo → SMS Quote (≤ 5 minutes)

**Epic CF: Photo-to-SMS Quote**
The single value delivery path. Every V1 story must directly serve this flow or it is [V2].

---

**CF-1 — Lead triage screen**

```
Story: As Rob, I want a single "ready to quote" tray showing all new leads
       (DA notifications, inbound SMS, manual entries) so that I never lose
       a lead in my inbox.

Acceptance Criteria:
  Scenario: New DA lead appears
    Given a DA notification is received by the system
    When Rob opens the app
    Then a new card appears in the "Ready to Quote" tray
    And the card shows: address, DA description, received timestamp
    And the card is ordered by recency (newest first)

  Scenario: No leads in tray
    Given Rob has no outstanding leads
    When Rob opens the app
    Then the tray shows an empty state with "No leads yet" copy
    And a prominent "Add a lead manually" CTA is visible

Priority: Must-have
Effort: M
```

---

**CF-2 — Photo capture**

```
Story: As Rob, I want to snap 4–10 site photos within one tap of opening
       a lead card so that I never have to find photos in my camera roll later.

Acceptance Criteria:
  Scenario: Capturing photos for a lead
    Given Rob has tapped a lead card
    When the lead detail screen opens
    Then a "Take photos" button is the primary CTA (≥ 48px touch target)
    And tapping it opens the native camera (not a file picker)
    And each captured photo is immediately attached to the lead with EXIF + GPS retained
    And a thumbnail strip shows all attached photos with a count

  Scenario: Uploading existing photos
    Given Rob has photos already in his camera roll
    When he taps "Upload from gallery"
    Then he can select up to 15 photos
    And each photo is uploaded with EXIF + GPS retained

Priority: Must-have
Effort: S
```

---

**CF-3 — Optional one-line context**

```
Story: As Rob, I want to add a one-sentence voice note or typed description
       so that the AI knows the job scope without me writing a full brief.

Acceptance Criteria:
  Scenario: Typing a context note
    Given Rob is on the lead detail screen with photos attached
    When he types in the context field
    Then the field accepts up to 280 characters
    And a placeholder reads "e.g. Re-roof, colorbond, single-storey, gutters too"

  Scenario: Context is optional
    Given Rob has attached photos but left the context field blank
    When he taps "Generate quote"
    Then the AI generation proceeds without error
    And a disclaimer note shows "No description added — AI will infer from photos only"

Priority: Must-have (field required to exist; content optional)
Effort: S
```

---

**CF-4 — AI quote generation (background, ≤ 60 seconds)**

```
Story: As Rob, I want the app to generate an itemised quote draft in the
       background while I continue driving to the next job so that I don't
       have to wait staring at a spinner.

Acceptance Criteria:
  Scenario: Quote generation starts
    Given Rob taps "Generate quote"
    When the job is submitted to the AI worker
    Then a "Generating..." status appears on the lead card
    And Rob can navigate away from the screen
    And a push notification fires when the draft is ready (target ≤ 60s)

  Scenario: Draft ready
    Given the AI worker completes the quote
    When Rob opens the lead card
    Then an itemised quote draft is shown with:
      - Materials: line items with description, quantity, unit, AU price (Bunnings/Reece live or cached)
      - Labour: line items at Rob's saved hourly rates
      - Subtotal, GST (10%), Total (AUD)
      - NSW contractor licence number (pre-filled from Rob's profile)
      - Statutory warranty wording (NSW Home Building Act)
      - AI generation confidence score per line item (0–100%)

  Scenario: AI generation exceeds 60-second target
    Given the AI worker has not responded within 60 seconds
    When the wall-clock budget is hit
    Then the partial draft is shown with a warning banner
    And below-confidence lines are auto-flagged for manual review

  Scenario: AI cost guard
    Given the AI worker is processing photos
    When the estimated token cost exceeds A$0.30 per quote
    Then the worker logs a cost-overrun warning
    And falls back to claude-sonnet-4-6 for the extraction pass

Priority: Must-have
Effort: XL
```

---

**CF-5 — Review and one-tap edit**

```
Story: As Rob, I want to review the AI draft and tap-edit any line I disagree
       with so that I can send an accurate quote without retyping everything.

Acceptance Criteria:
  Scenario: Reviewing a confident draft
    Given all line items have confidence ≥ 80%
    When Rob views the draft
    Then a green "Looks good — send" CTA is shown as the primary action
    And each line item shows its confidence score as a subtle badge

  Scenario: Reviewing a draft with flagged lines
    Given one or more line items have confidence < 80%
    When Rob views the draft
    Then those lines are highlighted in amber
    And a count banner reads "3 lines need review"
    And the primary CTA is "Review flagged lines" not "Send"

  Scenario: Editing a line item
    Given Rob taps a line item
    When the edit drawer opens
    Then Rob can adjust: description, quantity, unit price
    And the total, GST, and grand total recalculate instantly

  Scenario: Refusing to send an under-threshold quote
    Given the overall quote confidence is < 60% (>3 flagged lines unresolved)
    When Rob taps "Send anyway"
    Then a confirmation dialog explains the risk
    And Rob must explicitly confirm "Send with low-confidence lines"

Priority: Must-have
Effort: M
```

---

**CF-6 — SMS delivery with read receipt**

```
Story: As Rob, I want to send the approved quote by SMS with a tap-link
       so that the customer gets it immediately and I can see when they've opened it.

Acceptance Criteria:
  Scenario: Sending quote by SMS
    Given Rob has approved the draft
    When he taps "Send by SMS"
    Then a preview shows: customer name, mobile number, short message text, quote PDF link
    And Rob can edit the message text (max 160 chars for the SMS body)
    And tapping "Confirm send" dispatches the SMS via Twilio AU long-code

  Scenario: SMS delivered
    Given the SMS is dispatched
    When Twilio confirms delivery
    Then the lead card status updates to "Delivered" with timestamp

  Scenario: Customer opens the SMS link
    Given the customer taps the link
    When the quote view page loads
    Then the lead card status updates to "Opened" with timestamp
    And Rob receives a push notification "📋 Your quote was opened"

  Scenario: Email fallback
    Given the customer's mobile number is missing or SMS delivery fails
    When Rob taps "Send"
    Then the system falls back to sending a quote email via Resend
    And the lead card notes "Sent by email (SMS failed)"

Priority: Must-have
Effort: L
```

---

**CF-7 — Customer one-tap acceptance**

```
Story: As a homeowner, I want to accept a quote with one tap on my phone
       so that I don't have to sign and scan a PDF.

Acceptance Criteria:
  Scenario: Customer views quote and accepts
    Given the customer opens the quote link
    When the quote page loads (mobile-optimised)
    Then they see: itemised quote, total inc. GST, licence number, warranty clause
    And a prominent "Accept Quote" button is shown
    And tapping it records: customer name, timestamp, IP, device type
    And the acceptance is stored as a legally timestamped record

  Scenario: Rob notified of acceptance
    Given the customer taps "Accept Quote"
    When the acceptance is recorded
    Then Rob receives a push notification: "🎉 Quote accepted — [customer name], [address]"
    And the lead card status updates to "Won" with accepted timestamp

  Scenario: Customer declines
    Given the customer taps "Decline"
    When the decline is recorded
    Then the lead card status updates to "Lost"
    And Rob is notified with the decline reason (free text, optional for customer)

Priority: Must-have
Effort: M
```

---

**CF-8 — Onboarding (phone OTP + licence capture)**

```
Story: As a new tradie, I want to sign up with my phone number and NSW licence
       in one screen so that I can send my first quote without reading a manual.

Acceptance Criteria:
  Scenario: New user onboarding
    Given Rob visits the app for the first time
    When he enters his mobile number
    Then an OTP is sent via Supabase Auth (phone)
    And after OTP verification, he lands on a single "Profile setup" screen with:
      - Business name
      - Trade type (Roofer / Painter / Electrician / Plumber / Landscaper)
      - NSW contractor licence number (validated live against Service NSW lookup)
      - Default labour rate ($/hr) — pre-filled with industry median for trade type
    And completing this screen takes him directly to the "Ready to Quote" tray

  Scenario: Licence number invalid
    Given Rob enters an invalid or expired licence number
    When the Service NSW lookup returns no match
    Then an inline error: "Licence not found — check your NSW licence number or try again"
    And Rob cannot proceed to send quotes until a valid licence is confirmed

  Scenario: Existing user sign-in
    Given Rob has used the app before
    When he enters his mobile number
    Then OTP is sent and on verification he lands directly on the "Ready to Quote" tray

Priority: Must-have
Effort: M
```

---

### Supporting Flow 1 — DA-Lead Ingest → Ready-to-Quote Tray

**Epic SF1: DA Lead Pipeline**

```
SF1-1 — DA notification webhook ingest
Story: As Dana, I want DA notifications from the existing aggregator to
       automatically appear in the QuotingAgent tray so that no lead requires
       manual copy-paste.

Acceptance Criteria:
  Scenario: DA notification received
    Given the DA aggregator fires a webhook to QuotingAgent
    When the webhook payload is validated (address, DA description, council, timestamp)
    Then a new lead card is created in the crew's tray
    And the card is pre-populated with: address, DA description, council, DA reference number
    And a push notification is sent to the crew owner: "New DA lead — [address]"

  Scenario: Duplicate DA blocked
    Given the same DA reference number has already been ingested
    When the webhook fires again (retry)
    Then the duplicate is silently discarded
    And no second card is created

Priority: Must-have (for DA-wedge users; skip for direct-entry users)
Effort: M
```

```
SF1-2 — Manual lead entry
Story: As Rob, I want to manually add a lead from a phone call or SMS
       so that all my quotes live in one place regardless of lead source.

Acceptance Criteria:
  Scenario: Adding a manual lead
    Given Rob taps "Add lead"
    When he fills in: customer name, mobile, address (autocomplete via Google Places AU), job description
    Then a new lead card appears in the "Ready to Quote" tray

Priority: Must-have
Effort: S
```

---

### Supporting Flow 2 — FSM Push (ServiceM8 / Tradify)

**Epic SF2: FSM Integration**

```
SF2-1 — Push won job to ServiceM8
Story: As Rob, I want a won quote to automatically create a job in ServiceM8
       so that I never double-enter data between my quoting tool and my FSM.

Acceptance Criteria:
  Scenario: Quote accepted, ServiceM8 connected
    Given Rob has connected his ServiceM8 account (OAuth)
    And a quote is accepted by the customer
    When the acceptance webhook fires
    Then a new job is created in ServiceM8 with:
      - Customer name, mobile, address
      - Quoted line items as job notes
      - Quoted total as the job value
      - NSW licence number in the job record

  Scenario: ServiceM8 not connected
    Given Rob has not connected an FSM
    When a quote is accepted
    Then the acceptance is recorded locally
    And a banner prompts "Connect ServiceM8 to auto-create jobs"

Priority: Should-have
Effort: L
```

```
SF2-2 — Push won job to Tradify
Story: As Pete, I want a won quote to automatically create a job in Tradify
       so that I don't have to copy-paste between apps.

Acceptance Criteria: (mirror SF2-1 for Tradify REST API)

Priority: Should-have
Effort: L
```

---

### Supporting Flow 3 — Rate-Card Learning from Won Jobs

**Epic SF3: Rate-Card Learning**

```
SF3-1 — Capture actual invoiced amount on job completion
Story: As Rob, I want the app to note the final invoiced amount when I mark
       a job as complete so that the AI can learn my real margins.

Acceptance Criteria:
  Scenario: Marking a job complete
    Given a "Won" lead card
    When Rob taps "Mark as complete"
    Then a modal asks "Final invoiced amount (optional)"
    And entering an amount records: quoted vs. invoiced delta, materials used, trade type

  Scenario: Learning loop trigger
    Given Rob has ≥ 5 completed jobs with invoiced amounts
    When a new quote is generated
    Then the AI rate-card model incorporates Rob's historical margin data
    And a subtle badge reads "Personalised to your rates"

Priority: Should-have
Effort: XL
```

---

### Auto-Follow-Up (Supporting, not a separate flow)

```
SF4-1 — Scheduled SMS nudge on no-response leads
Story: As Rob, I want leads that haven't been responded to get an automatic
       SMS follow-up at D+3 and D+7 so that I never lose a job to forgetting.

Acceptance Criteria:
  Scenario: No customer action 3 days after quote sent
    Given a quote was sent and no acceptance/decline has been received
    When 3 calendar days elapse
    Then an SMS nudge is sent: "Hi [name], just following up on the quote I sent for [address]. Any questions? — Rob"
    And the lead card logs "Follow-up SMS sent D+3"

  Scenario: Rob disables follow-up for a specific lead
    Given Rob taps "Disable auto-follow-up" on a lead
    When the D+3 trigger fires
    Then no SMS is sent
    And the lead card shows "Auto follow-up disabled"

Priority: Should-have
Effort: M
```

---

### [V2] Tagged Stories (out of V1 scope)

The following are explicitly [V2] per `docs/01c-wedge.md` constraints:

| Feature | Tag | Reason |
|---|---|---|
| Invoicing and payment collection | [V2] | Out-of-wedge: not part of the quote-to-win flow |
| Job scheduling and dispatch | [V2] | FSM incumbents own this; anti-axis |
| Timesheets and crew tracking | [V2] | Out-of-wedge |
| Customer CRM beyond accept/decline | [V2] | Out-of-wedge |
| Multi-crew dispatch | [V2] | Anti-axis (>10 staff) |
| Good/Better/Best tiered quotes | [V2] | Anti-axis at V1 |
| Voice-memo input | [V2] | Valid UX improvement; not critical path |
| Commercial construction / blueprints | [V2] | Anti-axis always |
| Non-NSW markets (VIC, QLD, NZ) | [V2] | Expand months 18–24 |
| Native iOS / Android app | [V2] | PWA covers camera + EXIF at V1 |
| Materials ordering / supplier integration beyond pricing | [V2] | Out-of-wedge |
| Project costing and Gantt views | [V2] | Out-of-wedge |
| Multi-language support | [V2] | Western Sydney EN-first |
| Xero / MYOB sync | [V2] | Invoicing is V2; accounting sync follows |
| AroFlo / Fergus / simPRO integrations | [V2] | ServiceM8 + Tradify cover ICP |
| Deposit invoice on acceptance | [V2] | Payments are V2 |
| "Instant accept" Stripe payment on quote link | [V2] | Payments are V2 |
| Suburb-level pricing heat maps | [V2] | Nice analytics; not critical path |
| Crew-member accounts (multi-user per tenant) | [V2] | Owner-only at V1; crew portal V2 |

---

## 4. MVP Scope Definition

### V1 — MVP (Launch target: 6–8 weeks from kick-off)

**Hypothesis being validated:** A Western Sydney residential roofer or painter will pay A$99/month for a mobile-first tool that delivers an AU-priced, NSW-licence-bound, SMS-sent quote in under 5 minutes — if and only if the AI line-item accuracy is ≥ 80% on a 50-photo gold standard.

**Must-have stories (all CF stories + SF1-2, SF1-1 deprioritised to V1.1 if DA webhook integration is blocked):**
- CF-1: Lead triage screen
- CF-2: Photo capture (PWA camera API)
- CF-3: Optional one-line context
- CF-4: AI quote generation (BullMQ + Upstash, Opus-4-7 vision, Haiku extraction)
- CF-5: Review and one-tap edit
- CF-6: SMS delivery + read receipt (Twilio AU long-code)
- CF-7: Customer one-tap acceptance (web view)
- CF-8: Onboarding (phone OTP, NSW licence validation)
- SF1-2: Manual lead entry

**Should-have for V1 (ship in same sprint if effort allows, else V1.1):**
- SF1-1: DA webhook ingest (requires DA aggregator webhook contract)
- SF2-1: ServiceM8 push (OAuth integration)
- SF4-1: Auto-follow-up SMS (D+3, D+7)

**Done criteria for V1 launch:**
1. A roofer can complete the full critical flow (photo → SMS quote) in ≤ 5 minutes on a real device.
2. AI line-item accuracy ≥ 80% on the 50-photo promptfoo gold set.
3. NSW contractor licence validation works against Service NSW lookup.
4. AI per-quote cost ≤ A$0.30 measured on 20-quote load test.
5. SMS delivery confirmed on two AU carrier networks (Telstra, Optus) via Twilio.
6. Quote acceptance records a timestamped legal audit trail.
7. p50 photo-upload → push notification time ≤ 60 seconds.
8. All Playwright E2E scenarios for CF-1 through CF-8 pass in CI.
9. Typecheck + lint pass on main branch.
10. 3 roofer beta users have completed ≥ 2 real quotes end-to-end.

---

### V1.1 — Quick wins (weeks 8–12)

- SF2-1 / SF2-2: ServiceM8 + Tradify integration (if not shipped in V1)
- SF3-1: Rate-card learning loop (5+ completed jobs threshold)
- SF4-1: Auto-follow-up SMS (if not in V1)
- Improved AI draft UX: swipe-to-edit line items (mobile gesture)
- Quote PDF branding: logo upload, colour accent
- Basic dashboard: quotes sent / opened / won / lost counts

---

### V2 — Future roadmap

See [V2] table in Section 3. Key V2 bets:
1. Payments (deposit invoice on acceptance via Stripe)
2. Native iOS/Android app (if PWA camera UX underperforms)
3. Non-NSW state expansion (VIC, QLD with state-specific licence lookup)
4. Crew-member accounts + multi-user portal
5. Voice-memo input for job scope

---

## 5. Success Metrics

### KPIs — Measurable, not aspirational

| Metric | Definition | Target (30-day) | Target (90-day) | Measurement Method |
|---|---|---|---|---|
| **p50 photo-to-SMS time** | Median elapsed time from first photo upload to SMS delivered to customer | ≤ 5 min | ≤ 4 min | Server-side event log: `photo_uploaded` → `sms_delivered` |
| **p95 photo-to-SMS time** | 95th percentile of same | ≤ 10 min | ≤ 8 min | Server-side event log |
| **AI line-item accuracy** | % of AI-generated line items within ±15% of human-written equivalent on 50-photo gold set | ≥ 80% | ≥ 85% | promptfoo eval run in CI on every model/prompt change |
| **AI cost per quote** | Mean LLM token cost per completed quote | ≤ A$0.30 | ≤ A$0.25 | Token metrics logged per job, Sentry + provider dashboard |
| **Quote acceptance rate** | % of sent quotes that receive customer "Accept" tap | ≥ 35% | ≥ 45% | `quote_sent` → `quote_accepted` event funnel |
| **SMS open rate** | % of SMS-sent quotes where the quote link is tapped | ≥ 70% | ≥ 75% | Twilio delivery webhook + quote view page load event |
| **Onboarding completion** | % of new signups who complete onboarding and send ≥ 1 quote within 24h | ≥ 60% | ≥ 70% | `signup_completed` → `quote_sent` funnel, PostHog |
| **D7 retention** | % of activated users who generate ≥ 1 quote in week 2 | ≥ 50% | ≥ 60% | PostHog cohort, weekly |
| **D30 retention** | % of activated users still generating quotes in month 2 | ≥ 35% | ≥ 45% | PostHog cohort, monthly |
| **Paying crews** | Crews on A$99/mo subscription (post-trial) | 10 | 50 | Stripe subscription count |
| **Free-trial to paid conversion** | % of 14-day trial users who convert | ≥ 20% | ≥ 25% | Stripe: `trial_started` → `subscription_active` |
| **AI generation p50 latency** | Median wall-clock time from job queue entry to draft ready push notification | ≤ 60s | ≤ 45s | BullMQ job timestamps, Sentry performance |
| **NSW licence bind rate** | % of sent quotes that include a valid, verified licence number | 100% | 100% | Quote record: `licence_verified = true` required to unlock `Send` |

### Kill-switch triggers (from `docs/01c-wedge.md`)

- If AI accuracy < 80% after 8 weeks → reduce scope to template + AU rate-card + SMS (no AI line-item generation).
- If AI accuracy < 80% after 12 weeks → kill AI angle; pivot to fastest AU-priced template tool with NSW licence binding.
- If < 15/50 beta roofers/painters sign LOI at A$99/mo → kill the wedge.

---

## 6. Assumptions & Risks

| # | Assumption | Risk if Wrong | Validation Method | Priority |
|---|---|---|---|---|
| A1 | Claude Opus-4-7 vision can achieve ≥ 80% line-item accuracy on Australian residential roofing/painting photos | Core wedge fails; must reduce scope | promptfoo 50-photo gold set eval in week 2 of build | Critical |
| A2 | Twilio AU long-code SMS delivers reliably to Telstra/Optus/Vodafone AU consumers | SMS-first delivery fails; fall back to email-first | Send 100 test SMS across 3 carriers in week 1 | Critical |
| A3 | Service NSW contractor licence lookup API is available and returns licence status reliably | Must fall back to manual entry + periodic batch validation | Test API access in week 1 against test licence numbers | High |
| A4 | Bunnings live pricing is accessible via PowerPass API or scrape without blocking | Rate-card data degrades to cached/stale prices | Pursue Bunnings PowerPass partnership in parallel with build; test scrape in week 1 | High |
| A5 | PWA camera API on iOS Safari (WKWebView) provides sufficient photo quality for AI vision | Must build native iOS wrapper | Test on iPhone 14 iOS 17 in week 1; hold App Store account as fallback | High |
| A6 | Western Sydney roofers/painters will review and approve an AI draft rather than override everything | Quote review UX fails; tradie abandons after 2 uses | Beta test with 3 roofers in week 4; measure edit-per-draft count | High |
| A7 | A$99/mo per crew is within budget tolerance for the ICP | Must reprice or add commission alternative | 50 in-person interviews with WS tradies before month-end | High |
| A8 | DA aggregator webhook can be plumbed into QuotingAgent within the V1 timeline | SF1-1 ships as V1.1 | Confirm DA aggregator API contract in week 1 | Medium |
| A9 | Supabase RLS correctly isolates per-crew data under concurrent load | Data leak between tenants — critical security failure | Penetration test before beta | Critical |
| A10 | AI quote generation costs remain ≤ A$0.30 at 100 quotes/day | Unit economics break; must optimise prompt or downgrade model | Load test in week 6: 100 concurrent quote generations | High |

---

## 7. Open Questions

> Human checkpoint required before these are resolved. Do not unblock by assumption.

1. **DA aggregator webhook contract** — Is the existing DA aggregator ready to fire webhooks to QuotingAgent, or does integration require a separate sprint? (Blocks SF1-1 MVP vs V1.1 decision.)

2. **Bunnings PowerPass API access** — Has a formal API or partnership arrangement been initiated? If not, the initial rate-card source is the public Bunnings website (scrape) with the associated blocking risk (see A4).

3. **Rate-card baseline** — For the 50-photo promptfoo gold standard set, which human-written quotes will be used as ground truth? Do 50 labelled examples from real roofers exist, or does the team need to generate synthetic ground truth?

4. **ServiceM8 OAuth app approval** — ServiceM8 has a partner review process for OAuth apps. Has the partner application been submitted? Timeline could affect V1 vs V1.1 FSM integration.

5. **A$99/mo vs 3% commission** — Should both options be presented at beta launch (let the user choose), or should V1 ship with subscription-only and add commission alternative at V1.1? (Pricing skill to advise; wedge doc leaves this open.)

6. **Beta roofer / painter recruitment** — Have 3–5 Western Sydney roofers and painters been identified for week-4 beta test? If not, recruit now — this is on the critical path for the AI accuracy kill switch.

7. **Statutory warranty wording** — What is the exact NSW Home Building Act statutory warranty wording that must appear on every quote? Legal review required before this text is shipped in production quotes.

---

*Document end. Next phase: `analyst` (system requirements extraction). Critic gate required before advancing.*
