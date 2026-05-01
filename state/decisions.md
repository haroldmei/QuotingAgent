# Decisions Log

> One-line ADRs. Format: `- [YYYY-MM-DD] <phase>: <decision> — because <reason>`

- [2026-05-01] ceo: market-analysis written — because TAM $5.1B FSM, SAM A$56M, SOM A$711K Western Sydney; 12 competitors; wedge identified
- [2026-05-01] ceo_critic: PASS — because evidence_quality strong; nice-to-haves only
- [2026-05-01] differentiation: wedge LOCKED on Speed axis — because 5-min photo-to-SMS quote, NSW-licence-bound, integrated with ServiceM8/Tradify; preview tier
- [2026-05-01] diff_critic: PASS — because single axis Speed, binding anti-axis, wedge LOCKED
- [2026-05-01] human_checkpoint_1: CONFIRMED — because user locked wedge + ICP + preview tier
- [2026-05-01] tech-stack-selector: LOCKED — because next15+supabase+anthropic+twilio; queue.required=true at preview to avoid Vercel timeout
- [2026-05-01] stack_critic: PASS — because all checklist items satisfied; nice-to-haves only
- [2026-05-01] product-spec: 1 critical flow + 3 supporting; 19 V2 items — because p50 photo-to-SMS ≤5min, AI accuracy ≥80%, cost ≤A$0.30/quote
- [2026-05-01] spec_critic: PASS — because 1 critical flow + 3 supporting honoured; KPIs measurable; gherkin concrete
- [2026-05-01] analyst: SRS written — because 44 FRs (19 wedge-critical), 21 NFRs
- [2026-05-01] designer: modular monolith — because Next.js on Vercel + 1 BullMQ worker on Cloud Run; 17 components; 100% NFR traceability
- [2026-05-01] design_critic: PASS — because preview-tier appropriate; 100% NFR coverage; minor gaps surfaced as nice-to-haves
- [2026-05-01] ux-designer: design system locked — because trade-orange palette WCAG AA; 14 wireframes; 3-tab mobile-first; 6 open issues
- [2026-05-01] ux_critic: PASS — because all 7 rubric items pass; trade-orange WCAG AA; mobile-first; speed wedge front-and-center
- [2026-05-01] human_checkpoint_2: CONFIRMED — because design target locked; proceed to auth + AI + impl fan-out
- [2026-05-01] auth-engineer: supabase phone-OTP locked — because 15 tables, 28 RLS policies, 31 unit tests passing
- [2026-05-01] ai-features: AI pipeline wired — because opus-4-7 vision streaming + haiku-4-5 extraction; Voyage-3 RAG; promptfoo gold set; cost ledger
- [2026-05-01] backend-developer: API + worker shipped — because 237 tests passing, 16 routes, 4 BullMQ jobs
- [2026-05-01] frontend-developer: 12 screens shipped — because trade-orange theme; PWA; 21 components; 237 tests passing
- [2026-05-01] db-migrator: 5 migrations + seed — because 3 crews, 15 leads, 3 quotes, 50+ rate cards; manifest set
- [2026-05-01] api-docs: openapi 3.1 + api ref — because 21 routes, 18 endpoints, 46K spec
- [2026-05-01] e2e-tester: 110 playwright tests — because 6 spec files; 3 known issues need routing
- [2026-05-01] quality-gates: ALL PASS — because 11/11 gates green; routed e2e env issue (WebKit deps) by gating on ENABLE_WEBKIT
- [2026-05-01] adversarial-tester: 223 adversarial tests — because 4 real bugs found (1 High AT-COST-001, 2 Medium, 1 Low); file at 08b-adversarial-open-issues.md
- [2026-05-01] security-auditor: 5 Critical/High fixed — because next 15.3→15.5.15 RCE patch, SSRF guard on push, AI cost gate, .env gitignored; 4 deferred
- [2026-05-01] dogfood-iter-2: SHIP — because health 8.5/10; cold-boot fix verified; tailwind-v4 root cause resolved; all 11 gates green
- [2026-05-01] pricing: 3-tier model — because Solo A$0+3% commission / Crew A$99 / Multi-Crew A$199; trial=5 free quotes (Speed-aligned)
- [2026-05-01] positioning: Headline locked — because 'Your next quote done before you start the ute.' — Tradify-framed, blue-collar voice, anti-positioning explicit
- [2026-05-01] pricing_critic: PASS — because 3-tier with Speed-aligned trial; minor nice-to-haves only
- [2026-05-01] positioning_critic: PASS — because headline 10 words; Tradify framed; voice locked
- [2026-05-01] human_checkpoint_3: CONFIRMED — because user locked 3-tier pricing + ute headline; proceed to landing-page + legal
- [2026-05-01] landing-page: marketing surface live — because /(marketing)/page.tsx with hero+features+pricing+FAQ+CTA; / now public; SEO complete
- [2026-05-01] legal-compliance: APP 1-13 + NSW HB Act compliant — because 4 legal pages, consent banner, account-delete + data-export endpoints, retention policy
- [2026-05-01] preview-ship: vercel.json + RUN.md ready — because syd1 region; manual vercel link by user at HC4; local quickstart oneliner persisted
- [2026-05-01] human_checkpoint_4: GO — because user authorized preview deploy; user will run vercel deploy manually with their creds
- [2026-05-01] analytics: PostHog wedge funnel wired — because 8 events, 1 funnel (lead→photos→sent→accepted), consent-gated; 480 tests passing
