# Tech Stack Contract — QuotingAgent (Western Sydney AI Quoting)

## Date: 2026-05-01
## Stack version: 2026-Q2
## Scale tier: preview
## Wedge: For 1–10 staff Western Sydney trade owners, a site photo becomes an SMS-sent, AU-priced, NSW-licence-bound quote in under 5 minutes.
## Constraints: ai_heavy, multi_tenant_b2b, mobile_first

> This document is the **binding contract** for tech choices. Every
> downstream skill reads it. To change a vendor or pin, rerun
> `tech-stack-selector`. Do not silently substitute.

---

## 1. Stack matrix

```yaml
runtime:
  language: typescript
  node: "22.x"
  package_manager: pnpm

frontend:
  framework: next
  next_version: "15"
  router: app
  react_version: "19"
  css: tailwind
  tailwind_version: "4"
  responsive_priority: mobile-first     # mobile_first=true: job-site phone UX
  state:
    server: server-components
    client: zustand-or-swr
  forms: react-hook-form
  ui_kit: shadcn-ui
  pwa: true                             # mobile_first=true: offline-capable, camera API, installable

backend:
  framework: next-api-routes
  orm: prisma
  prisma_version: "5"
  validators: zod
  zod_version: "3"

database:
  engine: postgres
  postgres_version: "16"
  provider: supabase                    # preview tier: built-in RLS, auth, managed postgres
  pgvector: true                        # ai_heavy=true: embedding store for rate-card retrieval
  row_level_security: required          # multi_tenant_b2b=true: per-crew data isolation
  pooler: supabase-pgbouncer            # bundled with supabase; no extra config at preview tier

cache:
  engine: redis
  redis_version: "7"
  required: false                       # preview tier; enable at launch if queue load demands it
  provider: upstash                     # serverless Redis; zero infra at preview tier

queue:
  engine: bullmq                        # AI generation step is async; needed at preview
  required: true                        # wedge Step 4 (AI draft) is a background task
  backing: upstash-redis                # same Upstash Redis instance; no extra provisioning

testing:
  unit: vitest
  e2e: playwright
  load: k6
  mutation: stryker
  property: fast-check
  ai_eval: promptfoo                    # ai_heavy=true: 50-photo gold set, ≥80% line-item threshold

observability:
  logging: pino
  error_tracking: sentry               # free tier sufficient at preview; upgrade at launch
  metrics: provider-native             # Vercel analytics + Supabase dashboard at preview
  token_metrics: required              # ai_heavy=true: cost per quote tracked; budget ≤A$0.30

auth:
  default: supabase-auth               # multi_tenant_b2b=true; built into Supabase, no extra cost
  strategy: phone-otp                  # wedge constraint: ≤1 onboarding screen; tradie phone-native
  session: jwt-with-refresh
  password_hashing: argon2id
  multi_tenant:
    model: crew-as-tenant
    max_users_per_tenant: 10
    rls: required

email:
  provider: resend
  templates: react-email

sms:
  provider: twilio                      # wedge-critical: SMS-first quote delivery + read receipts
  au_long_code: required               # AU carrier deliverability; local sender ID
  read_receipt: webhook                 # Twilio delivery/read status webhook → quote card update

analytics:
  product: posthog
  consent: required-before-load

payments:
  provider: stripe
  au_gst: stripe-tax                   # AU GST (10%) handling; not EU MoR

ai:
  provider: anthropic
  models:
    vision_quoting: claude-opus-4-7    # highest accuracy for photo→line-item; wedge-critical
    line_item_extraction: claude-haiku-4-5   # fast + cheap for structured extraction pass
    fallback: claude-sonnet-4-6        # mid-tier if opus latency exceeds 20s wall-clock budget
  vector_store: pgvector               # ai_heavy=true, preview tier; pgvector in Supabase postgres
  eval: promptfoo
  cost_tracking: required              # ai_heavy=true: per-quote token cost logged, target ≤A$0.30
  cache_rate_cards: required           # wedge constraint: cache Bunnings/Reece prices aggressively
  confidence_scores: required          # wedge Step 5: per-line confidence; flag below-threshold lines
  latency_budget_seconds: 20          # wedge constraint: ≤20s wall-clock per AI call

external_integrations:
  fsm:
    servicem8: webhook-and-rest        # wedge Step 9: push won quote as job
    tradify: webhook-and-rest
  bunnings:
    method: scrape-or-api              # live AU pricing; PowerPass if API available
  service_nsw:
    method: rest                       # NSW Fair Trading licence number validation at onboarding

ci:
  provider: buildkite                  # BK_API_TOKEN + BUILDKITE_ORG confirmed in env
  registry: docker-hub
  reasoning: "Buildkite cheaper than GitHub Actions hosted runners; org creds provisioned"

deploy:
  preview_tier_target: vercel          # Next.js native; AU edge region (syd1)
  iac: none                            # preview tier skips Terraform
  region: ap-southeast-2              # AWS Sydney (Vercel edge); nearest to Western Sydney ICP

cloud:
  provider: gcp                        # PROJECT_ID=sunlit-core-205604 confirmed in env
  blob_storage: gcs                   # photo uploads (EXIF+GPS retained)
  cdn: cloud-cdn                      # PDF quote delivery

security:
  password_hashing: argon2id
  secrets_manager: gcp-secret-manager
  csp: required
  rate_limiting: required
  nsw_licence_binding: required       # Service NSW lookup + watermark on PDF output

feature_flags:
  provider: posthog-flags             # piggybacks on posthog analytics

storage:
  blobs: gcs                          # photo uploads; PDFs; EXIF metadata preserved
  cdn: cloud-cdn
```

---

## 2. Decisions (deltas from default matrix)

- chose `supabase` over bare postgres because `multi_tenant_b2b=true` + `preview` tier — built-in RLS, auth, pgvector, and pgbouncer in one managed service; no extra infra at preview scale
- chose `supabase-auth` over `lucia` or `clerk` because constraint `multi_tenant_b2b=true` and tier=`preview` — Supabase auth is bundled (zero extra cost), supports phone-OTP natively (tradie onboarding constraint), and integrates with RLS row-ownership patterns out of the box
- chose `phone-otp` auth strategy because wedge constraint requires ≤1 onboarding screen and tradie ICP is phone-native; email+password adds friction
- chose `pgvector` in Supabase over standalone vector store because constraint `ai_heavy=true` and tier=`preview`; pgvector is bundled in Supabase postgres, no separate service
- chose `claude-opus-4-7` as vision/quoting model (not `claude-sonnet-4-6`) because the wedge's ≥80% line-item accuracy threshold is the primary kill-switch trigger; Opus-class accuracy is required; Haiku used for fast structured extraction pass to keep cost within A$0.30 budget
- chose `twilio` SMS (non-default addition) because SMS-first quote delivery is wedge-critical (Step 6); read receipts via Twilio delivery webhook; AU long-code sender for AU carrier deliverability
- chose `queue.required: true` at preview tier (override of default `false`) because the AI generation step (Step 4, ≤60s) must be async — a synchronous Next.js API route would time out on Vercel's 10s function limit
- chose `upstash-redis` over self-hosted Redis because preview tier skips infra; Upstash is serverless, zero-config, and Fly/Vercel compatible; same instance backs BullMQ queue
- chose `pwa: true` because `mobile_first=true` — the capture step (camera, EXIF/GPS) must work on mobile web without an App Store gate; PWA install prompt covers the job-site use case
- chose `gcs` for blob storage because `PROJECT_ID=sunlit-core-205604` (GCP) is confirmed; photos with EXIF+GPS metadata must be preserved for AI vision input
- chose `stripe-tax` for AU GST (not `paddle`) because `eu_global_billing=false` and product is AU-only AUD pricing; no MoR needed, Stripe Tax handles 10% GST natively
- chose `buildkite` over `github-actions` because `BK_API_TOKEN` and `BUILDKITE_ORG` are confirmed in env; cost-effective for this org's scale
- chose `vercel` deploy target with `syd1` region because Next.js PWA framework + AU edge proximity for ICP (Western Sydney); preview tier, no Terraform

---

## 3. Negative space (not in stack)

```yaml
not_in_stack:
  - kubernetes: "preview tier; Vercel + Cloud Run sufficient; K8s is launch/scale concern"
  - graphql: "single-flow MVP; REST + Zod end-to-end type safety is simpler and faster to ship"
  - microservices: "one critical flow; monolith wins; split only if AI worker becomes a bottleneck"
  - kafka: "BullMQ + Upstash Redis sufficient; Kafka justified only at multi-region scale"
  - sendgrid: "Resend is the 2026 default; SendGrid retired as primary email provider"
  - bcrypt: "argon2id is the 2026 password-hashing default; bcrypt not acceptable for new code"
  - github-actions: "buildkite cheaper at this org's scale; BK_API_TOKEN provisioned"
  - auth0: "regulated=false; auth0 enterprise cost not justified at preview tier"
  - clerk: "multi_tenant_b2b handled by supabase-auth at preview tier; clerk cost not justified"
  - turbopuffer: "preview tier; pgvector in Supabase sufficient for embedding count at this scale"
  - terraform: "preview tier explicitly skips IaC; reintroduce at launch tier"
  - liveblocks: "realtime=false; no collaborative cursors or presence needed"
  - partykit: "realtime=false; SMS webhooks cover all async updates needed"
  - paddle: "eu_global_billing=false; AU-only product; stripe-tax handles AU GST"
  - expo-native: "mobile_first handled by PWA at V1; native iOS/Android is V2 unless camera UX fails"
  - native-ios-android: "PWA covers camera + EXIF at V1; revisit if App Store distribution needed"
  - clickhouse: "data_heavy=false; OLTP-only at preview; no analytics workload"
  - commercial-construction-apis: "anti-axis; residential NSW only in V1"
```

---

## 4. Quarterly review

Stack version pins are reviewed each quarter. Next review: **2026-08-01**.

At **A$300K ARR or 200 paying crews** (whichever first), re-evaluate:
- Move to `launch` tier: add Terraform, Sentry paid, Cloud Run, Redis required, queue hardened
- Add `perf-tester` and `observability` skills to the pipeline
- Re-evaluate `supabase` vs self-hosted postgres + pgbouncer if connection-count limits are hit

---

## 5. How downstream skills use this

| Skill | Reads from contract |
|---|---|
| designer | runtime, frontend, backend, database, cache, queue, ai, security |
| backend-developer | runtime, backend, database, validators, auth, ai, sms, external_integrations |
| frontend-developer | frontend (framework, css, state, forms, ui_kit, pwa, responsive_priority) |
| db-migrator | database (engine, version, pgvector, row_level_security, provider) |
| ux-designer | frontend.css, frontend.ui_kit, frontend.responsive_priority, frontend.pwa |
| api-docs | backend.validators, backend.framework |
| email-templates | email |
| background-jobs | queue, cache |
| analytics | analytics |
| observability | observability, ai (token_metrics, cost_tracking) |
| cicd | ci |
| deployer | deploy, cloud, iac |
| auth-engineer | auth (supabase-auth, phone-otp, crew-as-tenant, rls), security |
| ai-features | ai (provider, models, vector_store, eval, cost_tracking, confidence_scores, latency_budget_seconds) |
| landing-page | frontend.framework, deploy.preview_tier_target, sms.provider |
| legal-compliance | auth, security, nsw_licence_binding, payments |
