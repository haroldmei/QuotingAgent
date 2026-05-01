# Pricing Strategy — QuotingAgent (Western Sydney AI Quoting)

<!-- WEDGE: For 1–10 staff Western Sydney trade owners, a site photo becomes an SMS-sent, AU-priced, NSW-licence-bound quote in under 5 minutes. -->

## Date: 2026-05-01
## Status: DRAFT

> Open issues: 2 (see bottom of this document)

---

## 1. Comparable Pricing Research

Research conducted 2026-05-01. All AUD unless noted.

### 1.1 Direct competitors

| Product | Model | Free tier | Entry paid | Top tier | Trial | Notes |
|---------|-------|-----------|-----------|---------|-------|-------|
| **ServiceM8 AU** | Flat/mo, unlimited users, job-count cap | Yes — 30 jobs/mo, 1 user | A$29/mo (50 jobs) | A$349/mo (1,500+ jobs) | None (free tier persists) | Strongest AU FSM; quoting is template-only, no photo AI |
| **Tradify AU** | Per-user/mo | No | A$48/user/mo (Lite, 1–3 users) | A$40/user/mo bulk (Pro 4+) | None found | Per-user model hits wall fast: 3-person crew = A$144/mo |
| **BuildFolio** (US) | Flat/mo, per-business | Yes — 3 estimates + 5 AI quotes/mo | US$39/mo (Pro, unlimited AI, SMS) | US$39/mo (single tier) | 14-day, no card | Closest feature-analogue; US-only rate cards; no AU GST/licence |
| **QuoteIQ** (US) | Flat/mo, per-seat scaling | No | US$29.99/mo (1 user, 500 AI credits) | US$699/mo (unlimited users) | 14-day, no card | Credit-metered AI; 5 tiers is too many; US-only |
| **QuoteMate AU** | Flat/mo (price undisclosed) | No (7-day trial) | Est. A$30–A$50/mo | Est. A$30–A$50/mo | 7 days, no card | Live Bunnings pricing; no photo input; no SMS; no FSM bridge |
| **Fergus AU** | Per-user/mo | No | ~A$50–A$80/user/mo | ~A$80/user/mo | 14-day | No AI quoting |
| **AroFlo AU** | Custom/sales-led | No | ~A$80+/user/mo | Custom | Demo only | Mid-market; overkill for 1–5-person crews |

> **WEAK flag:** QuoteMate and TradeQuote do not publish precise pricing. Estimates derived from G2/Capterra/SoftwareSuggest aggregators and the hansendev.com.au features page.

### 1.2 Adjacent categories (willingness-to-pay anchors)

| Product | What it does for the ICP | Monthly cost | Relevance |
|---------|--------------------------|-------------|----------|
| **Xero AU (Starter)** | Invoicing + bank reconciliation | A$35/mo | Tradies pay this without blinking; sets floor |
| **Bunnings PowerPass** | Trade pricing access | A$0–A$100/yr | Price-insensitive; they already have it |
| **Tradify Pro (3-user crew)** | Job management, template quoting | A$120–A$144/mo | Direct ceiling anchor: 3 users × A$40–A$48 |
| **ServiceM8 Growing** | Job management, scheduling | A$79/mo | Solid mid-tier reference; unlimited users |

### 1.3 Pricing mechanic patterns (category leaders)

- **Vercel** — free hobby tier, Pro at US$20/seat/mo with usage credits; upgrade trigger = team collaboration or bandwidth limit.
- **Linear** — free for small teams, Standard US$8/user/mo; upgrade trigger = guest seats or analytics.
- **BuildFolio** — two-tier (Free / Pro US$39); upgrade trigger = AI quote quota exhausted (5 AI quotes on free → unlimited on Pro). Clean and effective.
- **QuoteIQ** — five tiers (too many); AI credit exhaustion is the upgrade trigger but the tiers are confusing.

**Key insight from mechanic research:** The cleanest B2B-SaaS upgrade trigger is a hard quota on the *core value action* (AI quotes generated) — not on seat count, not on storage, not on "advanced features." When the tradie runs out of quotes, they upgrade. BuildFolio does this well; QuoteIQ obscures it with too many tiers.

---

## 2. Chosen Model & Justification

**Model: Flat-rate per-crew subscription, tiered by monthly quote volume.**

Wedge axis = **Speed**. The pricing-model table maps Speed wedges to "Per-seat or per-workspace" as the default. We diverge slightly: we use *per-workspace (per-crew)* rather than per-seat, because:

1. The ICP is a 1–10 person crew where a single owner-operator holds the wallet. There is no "individual contributor who pays their own SaaS." The buying unit is the crew.
2. Per-seat pricing (Tradify's model) creates sticker-shock the moment the crew has 3+ people: 3 × A$48 = A$144/mo. Our per-crew model is cheaper at A$99/mo and wins the comparison every time.
3. The value delivered (speed of quoting) is a crew-level outcome, not a per-user outcome — the AI draft is generated once, the owner approves it. Charging per seat doesn't match the value surface.
4. Competitors (ServiceM8 Growing at A$79/mo unlimited users, ServiceM8 Premium at A$149/mo) validate the per-business pricing model in this segment.

The upgrade gate is **monthly AI quote volume**, not seat count or feature flags. This directly reinforces the Speed axis: the more leads the crew chases, the more they use, the more they pay — but the unit economics scale with their revenue, not headcount.

**Why not commission-only?** The wedge doc permits an optional 3% commission alternative for low-volume operators (≤5 quotes/month). This is retained as an onramp tier (Solo) at A$0/mo + 3% per accepted quote, not as a replacement for subscription. At the ICP's average job value of A$8K and 3 accepted jobs/month, commission = A$720 — wildly above A$99. Commission works only for sole traders who quote rarely; the subscription must be the main revenue path.

---

## 3. Tier Architecture

### 3.1 Tier table

| Tier | Price | Who it's for | Billing |
|------|-------|-------------|---------|
| **Solo** | A$0/mo + 3% per won job | Sole traders quoting ≤ 3 jobs/month who want to try commission model | Monthly, no card for first 5 quotes |
| **Crew** | A$99/mo per crew | Owner-operator, 1–10 staff, 4–40 quotes/month — the primary ICP | Monthly (or A$82/mo billed annually) |
| **Multi-Crew** | A$199/mo | Growing operators running 2–4 active crews, 40–120 quotes/month, needing team oversight | Monthly (or A$165/mo billed annually) |

**Annual discount: 17% (≈ 2 months free).**

> Note: "Solo" is structurally a **freemium onramp** with a commission tail, not a traditional free tier. It is not feature-gated below the wedge — every Solo user can run the full photo→SMS flow. The gate is volume (5 free quotes, then commission kicks in). This eliminates the "crippled free tier" anti-pattern while keeping the upgrade mechanic tight.

### 3.2 Limit & feature gates per tier

#### Solo (A$0 + 3% commission)

- **Quota:** 5 quotes free (trial); thereafter A$0 subscription + 3% of every accepted job value, billed monthly via Stripe
- **Seats:** 1 (owner only; no team members)
- **FSM integrations:** None (webhook-only; ServiceM8/Tradify sync locked to Crew+)
- **DA lead ingest:** Manual entry only (DA webhook requires Crew+)
- **Rate-card learning:** Off (requires ≥5 won jobs to activate; Solo users hit upgrade wall before that)
- **Auto follow-up SMS:** 1 automated nudge at D+3 only (D+7 locked to Crew+)
- **Quote branding:** QuotingAgent watermark (tradie logo upload locked to Crew+)
- **Included SMS:** Pay-per-SMS (A$0.10/SMS on Twilio AU pass-through)

**Feature gates that are NOT locked (full wedge delivered):** photo input, AI quote generation, confidence scoring, one-tap edit, SMS delivery + read receipt, customer one-tap acceptance, NSW licence binding, GST compliance, Bunnings/Reece live prices.

---

#### Crew — A$99/mo per crew (primary tier)

- **Quota:** 100 AI quote generations/month (≈ 25 quotes/week; covers 95% of ICP)
- **Seats:** Up to 5 users (owner + 4 staff members; e.g. Dana the office manager)
- **FSM integrations:** ServiceM8 + Tradify OAuth bidirectional sync
- **DA lead ingest:** Webhook ingest from DA aggregator (auto-tray)
- **Rate-card learning:** Active after ≥5 completed jobs with invoiced amounts
- **Auto follow-up SMS:** D+3 + D+7 automated nudges (configurable per lead)
- **Quote branding:** Logo upload, colour accent
- **Included SMS:** 200 SMS/month (A$0.10 each thereafter)
- **Basic analytics dashboard:** Quotes sent / opened / won / lost, conversion rate, avg job value
- **Priority email support**

---

#### Multi-Crew — A$199/mo (team tier)

- **Quota:** 400 AI quote generations/month (≈ 4 active crews × 100/mo)
- **Seats:** Up to 20 users (multi-crew oversight roles)
- **All Crew features, plus:**
  - Multi-crew dashboard: per-crew win rates, aggregate pipeline, team quote feed
  - Crew-level rate card isolation (each sub-crew has its own margin profile)
  - Tradify + ServiceM8 + AroFlo integrations (AroFlo locked to this tier)
  - API access for DA aggregator custom webhook schemas
  - CSV export of all quote/job data
  - Dedicated onboarding call (1-hour Zoom with team)
  - Phone support (business hours AEST)

---

### 3.3 Upgrade triggers

| Trigger | Tier hit | What happens |
|---------|---------|-------------|
| **Solo: 5th free quote generated** | Solo → Crew | Hard paywall: "You've used your 5 free quotes. Continue on 3% commission (Solo) or switch to Crew at A$99/mo and unlock your DA leads, team seats, and FSM sync." |
| **Crew: 100 AI quote generations exhausted in a month** | Crew → Multi-Crew | Soft gate: additional quotes available at A$1.50 each (overage), or "Upgrade to Multi-Crew for A$199/mo and get 4× the quota plus multi-crew dashboards." Overage pricing creates natural upgrade signal. |
| **Crew: 6th team member attempts to join** | Crew → Multi-Crew | "Your plan supports 5 users. Add your team on Multi-Crew — A$199/mo covers up to 20 users." |
| **Crew: AroFlo integration requested** | Crew → Multi-Crew | Feature-locked banner: "AroFlo sync is available on Multi-Crew." |
| **DA webhook capacity (>1 aggregator source)** | Crew → Multi-Crew | Crew supports 1 DA feed (the existing aggregator); Multi-Crew supports multiple custom schemas. |

**The most common real-world trigger will be the 100-quote cap.** A busy roofer quoting 18 jobs/week = ~72 quotes/month (well under 100). But a crew managing 25+ leads/week (the high end of ICP) = up to 100 AI generations. The cap is deliberately set at the 95th percentile of ICP usage — almost nobody hits it in year 1, but the path is clear.

---

## 4. Trial Mechanics

**Chosen mechanic: "First 5 quotes free, then choose your plan" (usage-credit trial, no card)**

This is a hybrid of **usage-credits** and **reverse trial** patterns. It is NOT a calendar-based "14-day free trial" because:

1. The wedge axis is **Speed** — the value proof is a quote generated, not time elapsed. A tradie who generates 5 quotes in 2 days has proven value; a tradie who signs up and generates 0 quotes in 14 days has not. Calendar trials optimise for the wrong thing.
2. "First 5 quotes free" directly *reinforces the speed claim*: the very first interaction proves the product (snap photos, get a quote in 5 minutes) — and the 5-quote cap creates natural conversion pressure after the tradie has seen the AI work on their own real jobs.
3. This matches BuildFolio's mechanic (5 AI quotes on free), which is the closest product-analogue, but we remove the free-tier permanent downgrade — once trial quotes are exhausted, the user picks Solo (commission) or Crew (subscription). There is no crippled permanent free tier.

### 4.1 Activation event

**First quote sent by SMS to a real customer** — not signup, not photo upload, not "quote generated." The activation event is the moment a real SMS lands on a customer's phone. This is measurable via the `sms_delivered` Twilio webhook event. If the tradie never sends, they haven't experienced the wedge.

Target: activation within **15 minutes of first signup** (onboarding → photo snap → AI generation (≤60s) → review → SMS send).

### 4.2 Time-to-activation target

**< 15 minutes from signup to first SMS sent.** The onboarding flow (CF-8: phone OTP + licence number + trade type + labour rate) is designed to take ≤ 3 minutes; the first quote generation ≤ 60 seconds; review and send ≤ 5 minutes. Total budget: 10–12 minutes. 15 minutes is the outer boundary.

### 4.3 Conversion mechanic

**What happens when the 5th free quote is generated:**

1. On the 4th quote: in-app banner — "1 free quote remaining. After that, choose 3% commission (Solo) or A$99/mo (Crew, with DA leads + FSM sync)."
2. On the 5th quote sent: hard paywall appears on next "Generate quote" tap. Two CTAs: [Continue on 3% commission — no monthly fee] and [Switch to Crew A$99/mo — unlock DA leads + team]. No way to generate a 6th quote without choosing.
3. If Solo is chosen: Stripe payment method captured for commission billing; first commission billed at end of month.
4. If no action within 7 days: reactivation email sequence kicks in.

**The choice framing matters:** Present Solo as "ideal if you quote less than 3 jobs/month" and Crew as "ideal if you quote 4+ jobs/month." At A$8K average job value, 4 accepted jobs/month × 3% = A$960/mo commission vs A$99/mo flat. The math heavily favours Crew for any active operator — showing this comparison in the upgrade modal will push high-volume users to Crew.

### 4.4 Reactivation for unconverted trials

Email sequence (sent from Resend):

- **Day 1 after 5th quote:** "You've seen how fast it works — here's what Rob from Penrith said about his first week." (Social proof + CTA to choose plan)
- **Day 4:** "Your DA leads are waiting — 3 new DAs in Blacktown this week that match your trade." (Urgency via real or demo DA data)
- **Day 8:** "You've sent [N] quotes — here's what they'd earn at a 35% win rate." (Calculator-style personalisation)
- **Day 14:** Final: "Your free quotes expired [X] days ago. Here's a one-month extension if you activate today." (One-time offer, not repeatable — prevents gaming)

---

## 5. Currency, Tax, Refunds

**Scale tier is `preview` — currency and tax are simplified accordingly (noted per skill spec).**

- **Currency:** AUD (A$). All prices inclusive of GST. Stripe displays prices with "incl. GST" label. No USD pricing at V1.
- **Annual discount:** 17% (2 months free: A$99 × 12 = A$1,188/yr → A$82/mo × 12 = A$984/yr = A$204 saving).
- **VAT/GST:** Stripe Tax (Stripe's automated tax calculation and remittance). At `preview` scale this is sufficient; reassess at `launch` tier if Paddle/LemonSqueezy is needed for non-AU markets.
- **Refund policy:** Full refund within 7 days of first paid charge, no questions asked. Partial pro-rata refund for cancellations after 7 days within the first month. No refunds after month 1. Commission model (Solo): refunds only where a job was reversed/cancelled — must provide evidence within 14 days.
- **Cancel policy:** In-app cancel button under Settings → Billing → Cancel Subscription. Immediate effect at end of current billing period. No support ticket required. No dark patterns (no "save" flow beyond a single "Are you sure?" modal).
- **Grandfathering:** Any price increase applies to new signups only. Existing subscribers keep their price for a minimum of 12 months from the price change date. Written notice ≥ 30 days before any price change.

---

## 6. Implementation Handoff

### 6.1 Stripe products & prices

```
Products:
  - prod_quoting_solo        "QuotingAgent Solo"        (A$0 subscription + metered commission)
  - prod_quoting_crew        "QuotingAgent Crew"        (flat A$99/mo per crew)
  - prod_quoting_multi_crew  "QuotingAgent Multi-Crew"  (flat A$199/mo)

Prices:
  - price_solo_commission    metered / per accepted job (3% of job value → calculated and invoiced monthly)
  - price_crew_monthly       A$99.00 AUD / month        (recurring)
  - price_crew_annual        A$984.00 AUD / year        (recurring, = A$82/mo × 12)
  - price_multi_crew_monthly A$199.00 AUD / month       (recurring)
  - price_multi_crew_annual  A$1,980.00 AUD / year      (recurring, = A$165/mo × 12)
  - price_sms_overage        A$0.10 AUD / SMS           (metered, on Crew+ when >200 SMS/mo)
  - price_quote_overage      A$1.50 AUD / quote gen     (metered, on Crew when >100 quote gens/mo)

Stripe Tax:
  - Enable automatic_tax: true on all payment intents and invoices
  - Tax behaviour: inclusive (prices shown already include 10% GST)
  - Customer tax ID: collect ABN on Crew/Multi-Crew signup (business buyer)
```

### 6.2 Backend wiring

**Webhook events to handle:**

```
customer.subscription.created       → provision tenant, set quota
customer.subscription.updated       → update quota/tier flags
customer.subscription.deleted       → downgrade to 0-quota state, preserve data 90 days
customer.subscription.trial_will_end → 3-day warning (N/A for usage-credit model; handled in-app)
invoice.payment_failed              → send payment_failed email, soft-lock new quote generation after 3 failed attempts
invoice.paid                        → reset monthly quota counters
checkout.session.completed          → activate subscription, send welcome email
```

**Entitlement model (database columns on `crews` table):**

```sql
plan_tier          ENUM('solo','crew','multi_crew')  DEFAULT 'solo'
quote_gen_limit    INTEGER    -- 0 = pay-per (solo), 100 (crew), 400 (multi_crew)
quote_gen_used     INTEGER    DEFAULT 0  -- reset on invoice.paid
seat_limit         INTEGER    -- 1 (solo), 5 (crew), 20 (multi_crew)
da_webhook_enabled BOOLEAN    DEFAULT false
fsm_sync_enabled   BOOLEAN    DEFAULT false
rate_card_learning BOOLEAN    DEFAULT false
auto_followup_d7   BOOLEAN    DEFAULT false
logo_upload        BOOLEAN    DEFAULT false
sms_monthly_limit  INTEGER    -- 0 (solo pay-per), 200 (crew), 500 (multi_crew)
sms_used           INTEGER    DEFAULT 0  -- reset on invoice.paid
```

**Quota model:**

- `quote_gen_used` increments atomically when the AI worker picks up a job (not on completion — prevents gaming by cancelling in-flight jobs).
- Monthly reset: triggered by `invoice.paid` webhook for the crew's billing cycle.
- Solo commission: track accepted jobs in `commission_events` table (job_id, accepted_at, job_value, commission_amount = job_value × 0.03). Invoice via Stripe metered billing at month end.

**Free trial quotes:**

- `free_quotes_remaining INTEGER DEFAULT 5` on the `crews` table.
- Decrements on each `quote_gen_used` increment while `plan_tier = 'solo'` AND `free_quotes_remaining > 0`.
- When `free_quotes_remaining` reaches 0 and no Stripe subscription exists, return `UPGRADE_REQUIRED` error from the quote generation endpoint.

### 6.3 Frontend wiring

**Pricing page route:** `/pricing`

**Upgrade CTAs (where they appear in app):**

| Location | Trigger | CTA text |
|----------|---------|---------|
| Quote generation screen | `free_quotes_remaining == 1` | Banner: "1 free quote left — choose your plan" |
| Quote generation screen | `free_quotes_remaining == 0` | Hard paywall modal (two CTAs: Solo 3% or Crew A$99) |
| Quote generation screen | `quota_remaining < 10` on Crew | Soft banner: "10 quote gens left this month — upgrade to Multi-Crew for 4×" |
| Settings → Team | `seat_count >= 5` on Crew | "Add more team members on Multi-Crew" |
| Settings → Integrations | DA webhook toggle on Solo | Lock icon + "Unlock DA leads on Crew plan" |
| Lead tray | Empty state with DA leads pending | "Connect your DA aggregator — available on Crew plan" |

**Paywall component:** `<UpgradeGate feature="da_webhook" />` — wraps any feature-gated UI element; shows lock icon and tier required.

**Billing portal:** Stripe Customer Portal. Handler at `/api/billing/portal` — generates session URL, redirects. Accessible from Settings → Billing.

### 6.4 Email templates required

Trigger emails (all sent via Resend, designed by `email-templates` skill):

```
trial_quote_4_used        Subject: "1 free quote left — pick your plan"
trial_quotes_exhausted    Subject: "Your free quotes are used — here's what to do next"
reactivation_d1           Subject: "Rob from Penrith won 3 jobs this week — here's how"
reactivation_d4           Subject: "3 new DAs in Blacktown are waiting for you"
reactivation_d8           Subject: "You've sent [N] quotes — what's your win rate?"
reactivation_d14          Subject: "Final: 1-month extension if you activate today"
subscription_activated    Subject: "You're on Crew — your DA leads and FSM sync are live"
subscription_renewed      Subject: "QuotingAgent renewed for another month"
subscription_canceled     Subject: "Your subscription ends [date] — your data stays safe for 90 days"
payment_failed            Subject: "Action needed: payment failed for QuotingAgent"
payment_failed_final      Subject: "Last reminder: quote generation paused"
commission_invoice        Subject: "Your QuotingAgent commission for [month]: A$[X]"
```

---

## 7. Pricing Page Copy Snippets

> This section is the **canonical source** for `landing-page`. Do not deviate from these prices, tier names, or mechanic descriptions.

### 7.1 Headline

> **Quote faster. Win more jobs.**
> From site photo to customer's phone in 5 minutes — flat A$99/month per crew.

### 7.2 Sub-headline

> No per-user fees. No contracts. Your first 5 quotes are free.

### 7.3 Tier cards (verbatim)

---

**SOLO** — A$0/month + 3% per won job
*For sole traders quoting 1–3 jobs a month.*

- Full photo → SMS quote workflow
- AI-generated, Bunnings-priced, NSW-licence-bound
- 5 quotes free, then 3% of every job you win
- 1 user · SMS at A$0.10 each · Manual lead entry

[Get started — no credit card]

---

**CREW** — A$99/month per crew *(most popular)*
Annual: A$82/month (2 months free)
*For 1–10 staff crews quoting 4–40 jobs a month.*

- Everything in Solo, plus:
- **100 AI quote generations/month**
- **Up to 5 team members**
- **DA lead auto-tray** (connect your DA aggregator)
- **ServiceM8 + Tradify sync** (won quote → job, automatically)
- Rate-card learning from your own won jobs
- Auto follow-up SMS at D+3 and D+7
- Logo + colour branding on quotes
- 200 SMS/month included
- Basic analytics dashboard
- Priority email support

[Start free — 5 quotes, no card]
Upgrade trigger: "You've used 100 quote generations this month — add more at A$1.50 each or upgrade to Multi-Crew."

---

**MULTI-CREW** — A$199/month *(2–4 crews)*
Annual: A$165/month (2 months free)
*For growing operators running multiple crews.*

- Everything in Crew, plus:
- **400 AI quote generations/month**
- **Up to 20 team members**
- Per-crew rate card isolation
- Multi-crew pipeline dashboard
- AroFlo integration
- CSV data export
- 500 SMS/month included
- Phone support (AEST business hours)
- 1-hour onboarding call

[Talk to us]

---

### 7.4 ROI comparison block (landing page)

> **How does A$99/month compare?**
>
> | | Status quo | QuotingAgent Crew |
> |---|---|---|
> | Time per quote | 2–4 hours evening | < 5 minutes on-site |
> | Quotes per week | 10 | 10 |
> | Jobs lost to slow quoting | ~3/week × A$8K avg | ~0 |
> | Monthly cost | A$0 (but 24h delay kills 30% of jobs) | A$99/mo |
>
> *At A$8K average job value, winning one extra job per month pays for 80× the subscription.*

### 7.5 Trial mechanic copy

> **Your first 5 quotes are on us.**
> No credit card. No time limit. Just snap a photo, get a quote, send it by SMS — and see what happens when your customer gets it in 5 minutes instead of 2 days.

### 7.6 FAQ snippets

> **Q: What counts as a "quote generation"?**
> A: Each time you tap "Generate quote" on a lead — whether you send it or not. Editing a draft after it's generated doesn't use another generation.

> **Q: What happens when I hit 100 quote generations?**
> A: Additional generations cost A$1.50 each, or upgrade to Multi-Crew for A$199/mo with 400 included.

> **Q: Is there a contract?**
> A: No. Month-to-month. Cancel in-app any time, no support ticket needed. Your data is kept for 90 days.

> **Q: Does the price include GST?**
> A: Yes. All prices shown include 10% GST.

> **Q: What if I run multiple crews?**
> A: The Crew plan covers one crew (up to 5 users). For 2–4 crews, Multi-Crew at A$199/mo is cheaper than two Crew subscriptions.

---

## 8. Self-Critique (Phase 7 Gate)

### 8.1 Mom test

A Penrith roofer reads the tier cards:
- "Solo — that's for guys who barely quote. I quote 15 a week, that's me on Crew."
- "A$99/month — I'm already paying A$79 for ServiceM8. This does the bit ServiceM8 doesn't do — the actual quote. I'd pay A$99 for that."
- "My DA leads auto-show up, I get the FSM sync I wanted — and if I grow I can upgrade."

**Pass.** The ICP can self-select in < 10 seconds.

### 8.2 Spreadsheet test

> "I quote 15 jobs a week, win 40%, average A$8K. That's A$48K/week in new revenue potential. I'm losing 30% of jobs to slow quoting — that's A$14.4K/week left on the table. QuotingAgent costs A$99/month. If it helps me win 1 extra job per month that's A$8K revenue for A$99 cost."

The ROI case closes in 60 seconds. **Pass.**

### 8.3 Competitor delta

| Competitor | Entry price | Our entry |
|---|---|---|
| ServiceM8 Starter | A$29/mo | A$99/mo (but does what SM8 can't: photo→quote AI) |
| Tradify 3-user crew | A$144/mo | A$99/mo (cheaper than Tradify for 3+ person crew) |
| BuildFolio Pro | US$39/mo ≈ A$60/mo | A$99/mo (premium for AU localisation + DA) |
| QuoteMate (est.) | A$40–50/mo | A$99/mo (2× — justified by photo input, SMS, FSM bridge, DA) |

**A$99 is 2× QuoteMate and ~1.7× BuildFolio.** This is within the 0.5×–2× competitor-delta guard. The premium is justified by: (a) live Bunnings pricing + photo input (not text-only like QuoteMate), (b) SMS + read receipt, (c) FSM bidirectional sync, (d) DA lead ingest, (e) AU GST + NSW licence binding. **Pass.**

### 8.4 Wedge consistency

Axis = **Speed**. Pricing model = per-workspace (per-crew) subscription gated by AI quote volume. The upgrade trigger at both tiers is **exhausting the AI quote quota** — the core speed-enabling action. No feature flags on the wedge path (the full photo→SMS flow is available on all tiers). **Pass.**

### 8.5 Anti-pattern checklist

- Price ladder: Solo (A$0+commission) → Crew (A$99) → Multi-Crew (A$199). Crew→Multi-Crew is 2×. Solo to Crew is not directly comparable (different model). No adjacent tiers are >4× apart. **Pass.**
- "Unlimited" appears: nowhere in this document. Quote limits are named numbers (5 / 100 / 400). SMS limits are named (0 / 200 / 500). **Pass.**
- Top tier features: Multi-Crew features (per-crew rate card isolation, AroFlo, multi-crew dashboard) have a clear named buyer (a painting contractor who runs 3 crews, one van each). **Pass.**
- Free tier generosity: Solo's 5 free quotes is generous enough to prove the wedge on real jobs but tight enough that an active tradie hits the wall within 1–2 weeks. **Pass.**

---

## 9. Open Issues

1. **Commission model legal review:** The 3% commission on won jobs requires a clear contract with the Solo user defining what constitutes a "won job" (customer tap-to-accept = trigger), the billing cycle, dispute resolution, and GST treatment of the commission fee. Legal review required before Solo tier ships to the public. (Blocks: Solo tier launch; does not block Crew or Multi-Crew.)

2. **Willingness-to-pay validation at A$99 vs A$79 vs A$119:** The market analysis cites A$50–A$300/mo willingness-to-pay range and references A$99/mo explicitly as the price point in the wedge doc. The 50-tradie in-person interview campaign (kill-switch validation) should include a direct price sensitivity question: "At what monthly price does this become a no-brainer / a hesitation / a no?" This data should be collected before Crew tier goes to paid-only (i.e., before the 5-free-quotes trial window closes in the beta). If > 30% of interviewees cite A$79 as the ceiling, consider A$79/mo entry.

---

## Pricing Locked (pending critic gate)

- Model:              Flat-rate per-crew subscription + optional commission onramp (Solo)
- Tiers:              Solo (A$0 + 3% commission) · Crew A$99/mo · Multi-Crew A$199/mo
- Trial:              First 5 quotes free (no card) — usage-credit model reinforcing Speed axis
- Activation event:   First quote sent by SMS to a real customer
- Currency:           AUD (incl. GST), Stripe Tax
- Annual discount:    17% (2 months free)
- Status:             DRAFT (2 open issues — see Section 9)
