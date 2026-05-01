# Wedge & Differentiation — QuotingAgent (Western Sydney AI Quoting)

## Date: 2026-05-01
## Status: LOCKED

<!-- WEDGE: For 1–10 staff Western Sydney trade owners, a site photo becomes an SMS-sent, AU-priced, NSW-licence-bound quote in under 5 minutes. -->

---

## 1. The Six Forcing Questions

### 1.1 Who, exactly?

A **2–5 staff residential roofer or painter in the Parramatta / Blacktown /
Penrith corridor of Greater Western Sydney**, owner-operator or owner-plus-
spouse, A$300K–A$2M annual revenue, holding a current Service NSW contractor
licence, **already paying A$50–A$300/mo for ServiceM8 or Tradify**, quoting
5–25 jobs/week with a ~30–50% conversion rate. The trigger event is the
moment a lead lands — a phone call, an SMS, or a DA notification from the
existing aggregator wedge — and the owner is standing on a Tuesday afternoon
job-site with a phone, a tape measure, and forty-five minutes between
appointments before the next homeowner asks "when can you send me a
price?"

Not vague. Not "Australian tradies." Not "construction SMBs." A single
residential roofer in Penrith, on Tuesday afternoon, between two jobs.

### 1.2 What do they do today?

Tuesday 2:47pm. The owner finishes a re-roof in St Marys, gets back in the
ute, checks his phone: three missed calls and a DA notification. He drives
to the next site in Doonside, takes 8 phone photos of the roofline, scribbles
"≈180 m², single-storey, colorbond, gutters need replacing" on the back of a
docket, then drives home. After dinner (8:30pm–10:00pm) he opens his laptop,
fires up Tradify or a Word template, looks up Bunnings prices for colorbond
sheet/gutter/screws (or copies last quarter's prices from memory),
multiplies by area, adds labour at a number he half-remembers, slaps GST on
the bottom, exports to PDF, emails it. The customer reads it Thursday.
Friday a competitor who quoted Wednesday morning has already won the job.

Tools: ServiceM8 or Tradify (template), Bunnings PowerPass app (price
lookup), Word/Excel (one-off custom quotes), Gmail (delivery), SMS (the
ad-hoc "did you get my quote?" follow-up). Time per quote: **2–4 hours of
owner time**, mostly evenings, plus **24–72 hours elapsed before the quote
lands**. The pain is concentrated in three places: (a) typing line items
the owner has typed 100 times before, (b) looking up current Bunnings
pricing, (c) the lag between site visit and customer receiving the PDF.

### 1.3 What would they pay for today (no AI required)?

They are already paying A$50–A$300/mo for FSM tools, A$100–A$300/yr for
Bunnings PowerPass, and A$0–A$200/mo to a bookkeeper. The proven willingness-
to-pay is for **anything that compresses the 24–72 hour quote lag and the
2–4 hour owner-time**. A human virtual assistant who took the photos and
returned a typed quote in 2 hours would clear A$99/mo easily — that's the
benchmark. We do not need AI to justify the wallet open; we need to deliver
the *outcome* (fast, accurate, AUD-priced quote) the wallet is already open
for. AI is the cost-effective delivery mechanism, not the value proposition.

### 1.4 The narrowest possible first version

**One sentence:** *Take photos of a residential roof, get a Bunnings-
priced, NSW-licence-stamped, GST-correct itemised quote on the customer's
phone via SMS within 5 minutes.*

That's it. Not invoicing, not scheduling, not project management, not
materials ordering, not commercial blueprints, not voice memos, not
Good/Better/Best tiering, not multi-trade. **Just: photo → SMS quote →
read receipt, in under 5 minutes, for residential roofing in NSW, in AUD,
with the tradie's licence number bound to the quote.**

One engineer can describe this in one sentence. We deliberately ship for
roofers first — they have the most photo-readable sites and the most
acute quote-time pain. Painters in week 6, then plumbers/sparkies/
landscapers in months 3–9.

### 1.5 The single observation no incumbent has acted on

**No incumbent binds the NSW Fair Trading contractor licence number, AU GST
formatting, and statutory warranty wording into the AI quote output by
default — and no incumbent pairs lead-source (DA aggregator) with auto-
quote on the same bill.**

The competitor matrix in `docs/01-market-analysis.md` is unambiguous:
ServiceM8/Tradify/AroFlo do AU compliance but no photo→quote AI.
BuildFolio/QuoteIQ/Handoff do photo→quote AI but no AU compliance, no
Bunnings, no DA pipeline. QuoteMate has Bunnings live pricing but no
photo input, no SMS, no FSM bridge, no licence binding. **The intersection
of (photo→quote AI) × (AU rate cards) × (SMS+read receipt) × (NSW licence-
bound output) × (DA-lead pipeline) is empty.** That intersection is the
blind spot. It is non-obvious from the outside because it requires
simultaneously caring about (a) AI vision quality, (b) Australian
regulatory plumbing, and (c) lead-gen integration — three skills that
rarely live in the same team.

### 1.6 10× not 10%

Status quo: **24–72 hours from site-visit to quote-in-customer's-hand,
2–4 hours of owner time per quote.**

Wedge: **5 minutes from photo-snap to SMS-delivered quote, ≤ 60 seconds
of owner time per quote** (the time to snap photos and tap "send"; the
review-and-edit pass is optional and async).

That is **~300× faster on elapsed time and ~120× less owner time**.
Order-of-magnitude jump, on a metric (quote speed) the market analysis
identifies as the **#1 win-rate factor** (73% of customers pick whoever
responds within 24h; we collapse that to 5 minutes).

This is not "faster than Tradify." This is "the quote is on the
customer's phone before the tradie has driven to the next job."

---

## 2. Chosen Axis

**Speed.** Specifically: **user time-to-result on the single quote workflow**,
measured as elapsed minutes from photo-capture to SMS-delivered, customer-
readable, NSW-compliant quote.

### Rationale

- The market analysis names quote speed as the #1 win-rate factor (30% of
  jobs lost to slow quoting; 73% of customers pick the contractor who
  responds <24h). Speed *is* the buying criterion.
- Price is not the axis: buyers already pay A$50–A$300/mo and are not
  price-sensitive at A$99/mo. Competing on price would shrink margin
  without winning the deal.
- Depth is not the axis: depth-for-niche means feature surface area
  (project costing, materials inventory, multi-crew dispatch) — that's
  AroFlo/simPRO territory, the wrong battle for a 1–5 person crew.
- Niche (Western Sydney trades) is the *focus*, not the axis — niche
  alone doesn't beat the incumbents who already serve that niche.
- Integrations (DA lead → quote) is a **moat**, not the axis — it
  amplifies speed (no copy-paste between systems) but the user-visible
  promise is still "5 minutes."
- Trust/Compliance (NSW licence binding) is a **floor**, not the axis —
  it's table-stakes that incumbents lazily skip; we make it free and
  invisible.

### What this axis costs us

- We will NOT have the deepest project-costing module. AroFlo/simPRO win
  there.
- We will NOT have the broadest FSM surface area. ServiceM8/Tradify win
  there.
- We will NOT have the prettiest mobile-first UX kitchen-sink. We will
  have the *fastest* one path through the app.
- We will NOT have multi-vertical day-one (no commercial construction,
  no enterprise, no non-AU markets).

The cost is real and named. We accept it.

---

## 3. Anti-axis

**We are NOT a Field Service Management platform.** We will not build
scheduling, dispatch, timesheets, invoicing, payments, materials
inventory, project Gantt charts, multi-crew assignment, customer CRM
beyond the bare minimum to send a quote and capture a "yes/no" response,
or any commercial-construction takeoff. We will NOT compete on feature
surface area. We will NOT support crews >10. We will NOT support non-
residential work in V1. We will NOT support markets outside NSW in V1.
We will NOT ship a desktop-first experience. We will NOT use US-based
rate cards or US suppliers.

This anti-axis is binding. Every later skill (`product-spec`,
`backend-developer`, `frontend-developer`, `landing-page`) reads it as a
permission slip to *not* build something. If a feature does not directly
shorten the photo-to-SMS-to-yes loop, it is out of scope.

---

## 4. Wedge Workflow (≤ 10 steps)

The narrative the ICP recognises. Reading time: 30 seconds. Total elapsed
time in the workflow itself: **under 5 minutes**.

### Step 1 — Lead lands
- **Inputs:** A new lead (DA notification from the aggregator, an inbound
  SMS, or a phone call the tradie types two lines about).
- **Output:** A "new quote" card on the home screen.
- **Today's pain:** Lead sits in inbox/voicemail/SMS for hours; no single
  place; tradie forgets to follow up.
- **Our 10×:** All three inbound paths consolidate into one "ready to
  quote" tray, ordered by recency.

### Step 2 — Tap the lead, snap photos
- **Inputs:** 4–10 phone photos of the site (roof, walls, problem area).
- **Output:** Photos uploaded with EXIF + GPS, attached to the lead.
- **Today's pain:** Tradie photographs but never structures; photos
  scatter across camera roll, WhatsApp, email.
- **Our 10×:** One tap. The capture screen *is* the home screen for an
  active lead — no menu, no album, no "where do I attach this?"

### Step 3 — Add one sentence of context (optional)
- **Inputs:** A voice note or one-line description: *"Re-roof, colorbond,
  single-storey, gutters too."*
- **Output:** Short text appended to the lead.
- **Today's pain:** Forces the tradie to type long descriptions in a
  template field.
- **Our 10×:** One sentence is enough; the AI infers the rest from
  photos. Optional, not required.

### Step 4 — AI generates the itemised draft (under 60 seconds)
- **Inputs:** Photos + optional sentence + the tradie's saved rate card
  (margins, labour rates) + Bunnings/Reece live prices + the trade
  profile (roofer / painter / etc.).
- **Output:** An itemised quote draft: materials with current AU prices,
  labour at the tradie's own rates, GST line, terms, NSW licence number
  watermark, statutory warranty wording.
- **Today's pain:** 1–2 hours of typing line items, looking up Bunnings
  prices, copying templates.
- **Our 10×:** ≤ 60 seconds, fully itemised, AU-priced, licence-stamped.
  Zero typing.

### Step 5 — Review & one-tap edit
- **Inputs:** The draft.
- **Output:** Final quote — confirmed or with line-item edits.
- **Today's pain:** Edits require leaving the doc, opening Bunnings,
  retyping.
- **Our 10×:** Each line shows a confidence score and a tap-to-edit
  field; below-threshold lines are flagged for review; the tradie can
  approve in one tap if the AI is confident.

### Step 6 — Send by SMS (and email, as fallback)
- **Inputs:** Approved quote.
- **Output:** SMS to the customer with a short message and a tap-link
  to the quote PDF; email backup; read receipt tracked.
- **Today's pain:** Email sent, customer doesn't open for 2 days; tradie
  has no visibility.
- **Our 10×:** SMS-first, AU carrier deliverability, read-receipt
  visible to the tradie in real time.

### Step 7 — Customer taps "Accept" (one tap)
- **Inputs:** Customer opens the SMS link on their phone.
- **Output:** Signed acceptance, deposit invoice (optional).
- **Today's pain:** Customer must reply to email, sign a PDF, scan it
  back. Friction kills 30% of would-be wins.
- **Our 10×:** One tap on the SMS link = signed acceptance, timestamped,
  legally compliant, pushed back to the tradie's phone as a notification.

### Step 8 — Auto-follow-up if no response (D+3, D+7)
- **Inputs:** No customer action for 3 days.
- **Output:** A polite SMS nudge sent automatically.
- **Today's pain:** Tradie forgets to follow up; the lead goes cold.
- **Our 10×:** Two scheduled SMS nudges, one tap to disable per lead.

### Step 9 — Push the won quote to the FSM the tradie already uses
- **Inputs:** Accepted quote.
- **Output:** Job created in ServiceM8 / Tradify with all line items,
  customer details, and the licence number attached.
- **Today's pain:** Quote in one tool, job in another; double-entry,
  drift, errors.
- **Our 10×:** Bidirectional integration; no double-entry; the tradie
  never leaves their existing FSM workflow.

### Step 10 — Learn from the won (or lost) job
- **Inputs:** Accepted/rejected status, final invoiced amount.
- **Output:** Rate card update — the AI learns this tradie's actual
  margin and labour reality.
- **Today's pain:** No competitor learns from the tradie's own won jobs;
  AI quotes never get more accurate.
- **Our 10×:** Each won job tightens the AI to *this* tradie's reality.
  After 20 won jobs the quote feels like the tradie wrote it.

**Sanity check:** "Our 10×" is a different concrete improvement at every
step, all serving the same axis (speed). Axis confirmed.

---

## 5. Kill Switches

These are conditions under which the wedge is abandoned. The `iterate` and
`signal-iterate` skills will read these.

### 5.1 Demand kill
**If, after 50 in-person conversations with Western Sydney roofers and
painters, fewer than 15 (30%) sign a non-binding letter of intent at
A$99/mo per crew (or 3% commission) — kill the wedge.**

Conversion below 30% means the pain isn't worth A$99/mo to enough of the
ICP, and the "tradie loses 30% of jobs to slow quoting" thesis doesn't
translate to wallet share.

### 5.2 Build kill
**If the photo→itemised-quote workflow cannot deliver ≤ 60-second AI
generation with ≥ 80% line-item accuracy (compared to a human-written
quote on the same photos) within 8 weeks of starting — reduce scope.**

Reduction path: drop the AI line-item generation, keep the AI material-
suggestion + AU-priced template + SMS + licence binding. That's still a
2× speed-up over status quo and still beats the AU FSM incumbents on
the workflow path. A 2× wedge is sub-optimal but shippable.

**If at 12 weeks we still cannot deliver ≤ 60s with ≥ 80% accuracy —
kill the AI angle entirely. Pivot to "fastest AU-priced template-driven
quote with NSW licence binding and SMS delivery." Still differentiated;
no longer ai_heavy.**

### 5.3 Defensibility kill
**If ServiceM8 ships photo→itemised-quote AI in AUD with NSW licence
binding before our V1 launches — pivot the wedge.**

Pivot path: lean harder on the **DA-lead → auto-quote compound moat**
(this is structurally hard for ServiceM8 to copy because they don't
have a lead-gen product), and on **rate-card learning from the tradie's
own won jobs** (this requires a learning loop they haven't built).
ServiceM8 catching up on photo→quote alone does not kill us if we own
the front of the funnel and the back of the learning loop.

**If ServiceM8 ships photo→quote AI AND lead-gen AND rate-card learning
all within 12 months — kill the standalone product, sell the DA aggregator
+ quote bundle as a ServiceM8 marketplace app, take rev-share.**

---

## 6. Constraints for downstream phases

### product-spec
- The MVP user-story map MUST contain exactly one critical flow:
  **"Tradie photographs a residential roof and the customer receives a
  Bunnings-priced, NSW-licence-stamped, GST-correct quote by SMS in
  under 5 minutes."**
- Max 3 supporting flows: (a) DA-lead ingest → ready-to-quote tray,
  (b) FSM push (ServiceM8/Tradify), (c) rate-card learning from won jobs.
- Anything else → `[V2]`. Specifically: invoicing, payments, scheduling,
  multi-crew dispatch, customer CRM beyond accept/decline, project
  costing, commercial-construction support, non-NSW state support,
  Good/Better/Best tiered quotes, voice-memo input → all `[V2]`.

### analyst
- FRs that do not directly serve the critical flow MUST be tagged
  `[Out-of-wedge]` and dropped from V1.
- The `[Out-of-wedge]` test: would removing this FR prevent a Western
  Sydney roofer from getting a photo to a customer's SMS in 5 minutes?
  If no, drop it.
- NSW Fair Trading licence binding is in-wedge. AU GST formatting is
  in-wedge. SMS read-receipt is in-wedge. Email-only fallback is in-
  wedge. Anything resembling "settings page for non-quote workflow"
  is `[Out-of-wedge]`.

### designer
- Architecture decisions MUST be justified against the 5-minute speed
  target. Round-trip latency budget per AI call: ≤ 20 seconds wall-clock.
- The cheapest architecture that delivers the wedge wins. No
  microservices for a single-flow MVP. One API service, one DB, one
  queue worker for the AI generation step, one Twilio (or AU equivalent)
  for SMS.
- Vendor-lock for speed: pick the LLM provider with sub-15s vision
  latency on Australian endpoints, even if it is not the cheapest.

### ux-designer
- The home screen of the app MUST make the wedge legible within 5
  seconds of first paint. Hero microcopy = a short paraphrase of the
  wedge sentence.
- The capture-photos button MUST be reachable within one tap of cold-
  open of the app.
- The "send SMS" action MUST be reachable within one tap of the AI
  draft being shown.
- Anything that adds a tap between photo-snap and SMS-send must be
  justified explicitly against the speed axis or removed.

### auth-engineer
- Auth MUST NOT add more than one screen to first-time onboarding.
  Single-step phone-number-OTP is preferred (matches tradie phone-
  native habits). NSW licence number is captured at onboarding step 2,
  validated against Service NSW lookup.
- Multi-tenant: each crew is a tenant; up to 10 users per tenant; RLS
  required.

### ai-features (ai_heavy: true)
- The 10× depends on AI line-item accuracy. Eval harness is
  non-negotiable: 50-photo gold-standard set, regression test on every
  prompt or model change, ≥ 80% line-item accuracy threshold to ship.
- Confidence scores per line item; below-threshold lines auto-flagged
  for human review; refuse-to-quote when overall confidence is too low
  (better to delay 10 minutes than send a wrong quote).
- Token cost budget: ≤ A$0.30 per quote at expected usage; cache rate
  cards aggressively.

### backend-developer / frontend-developer
- If a feature does not appear in the wedge workflow OR the three
  supporting flows, do not build it. Even if it would be "easy."
- The mobile web (PWA) experience is the primary surface; native iOS/
  Android is V2 unless the PWA cannot deliver acceptable camera UX.

### landing-page
- Hero headline = a 6–10-word paraphrase of the wedge sentence
  ("Photo to SMS quote in 5 minutes. Western Sydney trades.").
- Sub-headline = the 10× claim with one piece of evidence ("From 24 hours
  to 5 minutes — priced in AUD from Bunnings live, NSW-licence-stamped.").
- Three feature blocks max, each tied to a step of the wedge workflow:
  (a) Photo→quote in 5 minutes, (b) AU-priced and NSW-compliant by
  default, (c) Plumbed into the FSM you already pay for.
- No mention of features that aren't in the wedge workflow. No
  "everything you need to run your business."

### pricing
- Tier structure MUST reflect Speed-axis economics. Single primary tier
  at A$99/mo per crew flat (not per-user) — beats per-user FSM pricing
  the moment a crew has 3+ people. Optional 3% commission alternative
  for low-volume operators (≤ 5 quotes/mo).
- 14-day free trial with 5 free quotes; no credit card required for
  trial; after trial, A$99/mo or 3% commission on jobs won (pick one,
  switchable monthly).
- No "Pro" tier with extra features in V1 — feature gating contradicts
  the wedge (one workflow, done 10×).

### positioning
- One-line value prop = the wedge sentence (≤ 140 chars).
- Anti-positioning: explicitly distance from "FSM platform," "all-in-one
  business management," "for everyone." Position as "the world's fastest
  AI quote — Western Sydney trades only."

---

## 7. Stack constraints

```yaml
realtime: false                  # SMS read-receipts are pull-on-load; live cursors not needed
ai_heavy: true                   # 10× depends on vision-model line-item generation
regulated: false                 # NSW Fair Trading licence binding is a feature, not SOC2/HIPAA
multi_tenant_b2b: true           # crew = tenant, 1–10 users per tenant, RLS required
eu_global_billing: false         # AU-only V1, AUD only, no EU VAT
mobile_first: true               # owner is on a phone on a job-site; mobile web (PWA) is primary
data_heavy: false                # OLTP per-quote; no analytics workload of consequence in V1
```

Justifications for each `true`:

> `ai_heavy: true` — the wedge axis is **speed**, and the 10× (60-second
> itemised draft from a photo) depends entirely on vision-model accuracy.
> Without the AI line-item generation, the wedge collapses to a 2×
> template improvement — interesting but not defensible.

> `multi_tenant_b2b: true` — every customer is a crew (1–10 staff) on a
> shared tenant; the owner buys, employees use; per-tenant rate cards,
> NSW licence numbers, and Bunnings PowerPass credentials require RLS.
> Without proper multi-tenancy, rate-card learning leaks between crews.

> `mobile_first: true` — the ICP is on a job-site with a phone, dirty
> hands, no laptop. The capture step (photos + one-line context) MUST
> work on mobile web; a desktop-first design loses Step 2 of the wedge
> workflow on day one.

`regulated: false` is a deliberate call. NSW licence binding is feature
plumbing (Service NSW lookup API + watermark on PDF + database column).
It does not require SOC2 controls, HIPAA, or GDPR-strict postures — those
are buyer-side regulatory regimes our buyers don't have. The compliance
moat is *positional*, not architectural.

---

## 8. Scale Tier

## Scale Tier: preview

**Justification.** This is a single-region (Australia, AWS Sydney /
Vercel-AU / Fly Sydney) MVP for ≤ 100 paying crews in the first 6 months.
There is no multi-region requirement, no enterprise customer pre-signed,
no regulatory regime that mandates 99.99% SLAs. The market analysis
explicitly recommends `preview` and the risk register names "execution
risk — small team, ambitious scope" as the #6 risk; over-building infra
for an MVP is the most expensive mistake we could make.

`preview` skips: background-jobs (use platform-native cron), env-manager
beyond a `.env.production`, Terraform IaC, observability dashboards
(use platform logs), production-readiness review, and dedicated rollback
runbooks. We retain: typecheck, lint, unit, integration, and E2E gates
(speed accuracy is non-negotiable; AI eval harness is the highest-stakes
gate); auth (Lucia or Clerk based on tech-stack-selector); and basic
Sentry-equivalent error tracking.

We re-evaluate at **A$300K ARR or 200 paying crews** (whichever first).
At that point we move to `launch` tier (single-region SLAs, observability
dashboards, Terraform, production-readiness review). Multi-region
(`scale`) is gated on Melbourne/Brisbane expansion in months 18–24.

---

## Stack constraints (orchestrator hand-off block, repeated for parser)

```yaml
realtime: false
ai_heavy: true
regulated: false
multi_tenant_b2b: true
eu_global_billing: false
mobile_first: true
data_heavy: false
```

---

## Self-Critique (Phase 7) — passes

1. **Could a competitor copy the wedge in a weekend?** No. (a) AU
   rate-card ingestion + Bunnings/Reece live pricing requires supplier
   relationships and ongoing maintenance. (b) NSW Fair Trading licence
   binding requires Service NSW integration and the institutional
   knowledge of which warranty wording is statutory. (c) The compound
   DA-lead → auto-quote pairing requires a working DA aggregator (the
   user already has one — competitors don't). (d) Rate-card learning
   from the tradie's own won jobs is a multi-month feedback-loop that
   cannot be cloned without users. **Pass.**

2. **If we remove the chosen axis (Speed), does the product still win?**
   No. Without the 5-minute promise, this is just another AU quoting
   tool — QuoteMate / TradeQuote / FlowWorks already occupy that space
   with fewer features. The Speed axis is load-bearing: remove it and
   we're indistinguishable. **Pass.**

3. **Are there ≥ 2 places in the doc where the answer is "we'll be
   better"?** Re-read:
   - All "Our 10×" entries are concrete numeric or behavioural claims
     (≤ 60 seconds, one tap, ≥ 80% accuracy, etc.).
   - Section 2 rationale is concrete (300× elapsed-time, 120× owner-time,
     against the cited 30%/73% market data).
   - Anti-axis is a list of specific "we will not build X." **Pass.**

4. **Does the wedge sentence pass the Mom test?** *"For 1–10 staff Western
   Sydney trade owners, a site photo becomes an SMS-sent, AU-priced,
   NSW-licence-bound quote in under 5 minutes."* Read cold to a
   Penrith roofer: he leans in, because the words "site photo," "5
   minutes," and "NSW licence" are all in his daily vocabulary, and
   "AU-priced" is the unspoken complaint about US AI tools. **Pass.**

All four self-critique checks pass. Status: **LOCKED**.

---

## 9. One-Sentence Wedge Statement

> **For 1–10 staff Western Sydney trade owners, a site photo becomes an SMS-sent, AU-priced, NSW-licence-bound quote in under 5 minutes.**

Character count: 138. Under 140. Verbatim header for every downstream
skill: `<!-- WEDGE: For 1–10 staff Western Sydney trade owners, a site
photo becomes an SMS-sent, AU-priced, NSW-licence-bound quote in under 5
minutes. -->`

---

## Wedge Locked

- ICP:               1–10 staff Western Sydney roofer/painter (then sparkie/plumber/landscaper) owner-operator, A$300K–A$2M revenue, holding NSW contractor licence, already paying for ServiceM8/Tradify.
- Axis:              Speed (user time-to-result on the quote workflow)
- Anti-axis:         Not an FSM, not commercial-construction, not crews >10, not non-NSW V1, not desktop-first, not US-priced
- Wedge sentence:    For 1–10 staff Western Sydney trade owners, a site photo becomes an SMS-sent, AU-priced, NSW-licence-bound quote in under 5 minutes.
- Scale tier:        preview
- Kill switches:     3 (demand, build, defensibility)
- Status:            LOCKED
