# Iteration Log

## Iteration 0 — 2026-05-01

Initial preview-tier build of QuotingAgent (AI Quoting Agent for Trades, Western Sydney).

- Wedge: "For 1–10 staff Western Sydney trade owners, a site photo becomes an SMS-sent, AU-priced, NSW-licence-bound quote in under 5 minutes."
- Stack: Next.js 15 + Tailwind 4 + Prisma 5 + Postgres 16 + Supabase Auth + Anthropic (claude-opus-4-7 vision, claude-haiku-4-5 extraction) + Twilio SMS + Resend + Upstash Redis + BullMQ.
- Surface: 12 app screens + 18 API routes + 4 BullMQ workers + marketing landing + 4 legal pages + cookie consent.
- Tests: 480 passing across unit / mutation / integration / contract / e2e (chromium + mobile-android) / a11y / lighthouse / visual.
- Wedge funnel instrumented in PostHog (consent-gated): lead_received → photos_uploaded → quote_sent → quote_accepted.
- Dogfood iter-2: SHIP, health 8.5/10, real-browser cold-boot verified.
- KPI targets: p50 photo-to-SMS ≤ 5 min · AI accuracy ≥ 80% · cost ≤ A$0.30/quote · acceptance ≥ 35%.

Next: signal-iterate cadence weekly once preview deploy is live and seeded.
