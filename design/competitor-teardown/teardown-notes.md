# Competitor Teardown Notes — QuotingAgent UX Design Phase

Date: 2026-05-01

## Competitors Screenshotted

### 1. ServiceM8 (servicem8.com) — Primary incumbent
Screenshot: servicem8-homepage.png, servicem8-hero.png

**Hero copy:** "Smart job management for tradies & services — Cut paperwork, get more jobs done & provide great service."
**Pricing:** $0–$349/mo, per-job-count tiers (Free: 30 jobs/mo, Starter $29/mo: 50 jobs, etc.)
**Quoting UI:** Template-based quoting from the job screen. No AI, no photo→quote. Quote is created manually inside the job record.
**Mobile:** App-first but desktop-capable. No PWA. Requires install.
**Design language:** Green brand (#3D9B3C area), white cards, generic business software aesthetic. Desktop-centric layouts.
**Key gap:** No photo→quote AI. No SMS-first delivery. No AU-live rate cards. No read receipt on quotes.

### 2. Tradify (tradifyhq.com) — Secondary incumbent
Screenshot: tradify-hq-homepage.png

**Hero copy:** "The Best Tool to Run Your Business — Business management software that runs every job from start to finish."
**Pricing:** Not shown on screenshot; 14-day free trial, no credit card.
**Quoting UI:** Manual quote/estimate flow. "Quoting" and "Estimating" listed as features. No AI, no photo input.
**Mobile:** App-first (iOS/Android). No PWA mention.
**Design language:** Orange/amber accent on dark backgrounds, card-based layouts. Modern but desktop-centric.
**Key gap:** No AI. No photo→quote. No SMS delivery. No AU-specific rate cards. No read receipt.

### 3. BuildFolio (buildfolio.com) — Lead-gen site (not a direct AI quoting competitor)
Screenshot: buildfolio-homepage.png

**Hero copy:** "Where construction builds." — A lead-gen matching platform.
**Not a direct competitor** — connects homeowners to contractors, not a tradie-facing quoting tool.
**Noted for:** Shows homeowner-side UX patterns for requesting quotes.

## Key UX Takeaways for QuotingAgent Design

1. **No incumbent shows AI confidence scores** — our per-line confidence badge is novel
2. **No incumbent uses SMS-first delivery** — all use email PDF attachments
3. **No incumbent captures photos for AI processing** — camera capture is our differentiator
4. **Desktop-centric designs** — ServiceM8 and Tradify both feel like desktop apps stretched to mobile
5. **Long navigation flows** — ServiceM8 requires 4+ taps from app open to sending a quote; our target is 3 taps from cold open to generate
6. **Generic trade-agnostic** — no AU-specific content, no NSW licence binding visible in UI
7. **CTA patterns:** Both incumbents use "Start Free Trial" / "Book Demo" hero CTAs — transactional, not outcome-focused
8. **Our differentiator in UX:** The camera icon as the primary hero CTA, not "Start Trial" — the action IS the value demonstration
