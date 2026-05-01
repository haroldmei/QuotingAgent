# Run locally

Fresh clone to seeded, running app:

```bash
pnpm install && pnpm db:generate && pnpm db:migrate:deploy && pnpm db:seed && pnpm run dev
```

Before running, copy `.env.example` to `.env.local` and fill in the required values:
- `DATABASE_URL` — Supabase Postgres connection string
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_FROM_NUMBER` (AU long-code)
- (Optional, dev) `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — when unset, rate limiters fall back to no-op
- (Optional) `RESEND_API_KEY` for email fallback

After install + migrate + seed, the dev server is at http://localhost:3000.

- Marketing landing: `/` (public)
- Login: `/login` (phone OTP)
- Seed contents: see `state/artifacts/db-migrator.json#.required_paths` — 3 demo crews (Sydney Roofing, Penrith Painters, Blacktown Plumbing), 15 leads, 3 quotes, 50+ rate-card items
- Re-seed only: `pnpm db:seed`
- Run quality gates: `./scripts/quality-gates.sh`
- Run e2e (chromium only; mobile-safari opt-in via `ENABLE_WEBKIT=1`): `pnpm test:e2e`

## Wedge demo path

1. Sign up at `/login` with an AU mobile (+61 4XX XXX XXX)
2. Onboard at `/onboarding` — pick a trade, enter NSW contractor licence (test: 123456C)
3. Land on `/leads` (the inbox)
4. Tap a lead → `/leads/{id}/photos` → upload site photos + brief context
5. Tap "Generate quote" → wait for AI vision/quote (≤60s)
6. Review on `/quotes/{id}` → tap "Send" → SMS goes to customer
7. Customer opens `/q/{token}` → one-tap accept

End-to-end target: <5 minutes from photo upload to SMS delivered.

