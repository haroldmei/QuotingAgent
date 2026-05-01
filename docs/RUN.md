# Run locally

## Prerequisites

- Node.js 22+
- pnpm 10+
- Docker (for the local Postgres)

## One-time setup

```bash
# 1. Spin up a Postgres + pgvector container for QuotingAgent
docker run -d --name qa-pg \
  -e POSTGRES_USER=quotingagent \
  -e POSTGRES_PASSWORD=quotingagent_dev \
  -e POSTGRES_DB=quotingagent \
  -p 5433:5432 \
  pgvector/pgvector:pg16

# 2. Copy the env template
cp .env.example .env.local
```

`.env.local` ships with sensible defaults pointing at this container:

```
DATABASE_URL=postgresql://quotingagent:quotingagent_dev@localhost:5433/quotingagent
```

For real Anthropic / Twilio / Supabase integrations, fill in those keys
in `.env.local` (they are optional for the marketing + login + legal pages).

## Boot

```bash
pnpm install && pnpm db:generate && pnpm db:migrate:deploy && pnpm db:seed && pnpm run dev
```

What each step does:

- `pnpm install` — install workspace deps
- `pnpm db:generate` — generate the Prisma client
- `pnpm db:migrate:deploy` — applies the schema. Two paths:
  - **Local Postgres** (default): runs `supabase/bootstrap.sql` (creates `auth`
    schema + `auth.uid()` stub + `extensions` schema for pgvector) and then
    `prisma db push` to sync the Prisma schema directly. Idempotent.
  - **Hosted Supabase** (auto-detected from `*.supabase.co` URL, or set
    `SUPABASE_MIGRATE=1`): runs `supabase/migrations/*.sql` in order, tracked
    in `_supabase_migrations`.
- `pnpm db:seed` — 3 demo crews (Sydney Roofing, Penrith Painters, Blacktown
  Plumbing), 15 leads, 3 quotes, 12 line items, 39 rate-card items.
- `pnpm run dev` — boots Next.js at <http://localhost:3000>.

## What you get

- `/` — marketing landing page (public)
- `/login` — phone-OTP login screen (public)
- `/onboarding` — crew + NSW licence capture (public during signup)
- `/privacy` `/terms` `/cookies` `/acceptable-use` — legal pages (public)
- `/manifest.json` `/icons/*` `/sw.js` — PWA assets
- `/leads` `/quotes/*` etc. — auth-protected (redirect to `/login` until you
  authenticate)

## Re-seeding only

```bash
pnpm db:seed
```

## Resetting the local DB

```bash
docker exec qa-pg psql -U quotingagent -d quotingagent \
  -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;
      DROP SCHEMA IF EXISTS auth CASCADE;
      DROP SCHEMA IF EXISTS extensions CASCADE;'
pnpm db:migrate:deploy && pnpm db:seed
```

## Wedge demo path

Once you have real Supabase + Twilio + Anthropic env vars filled in:

1. Sign up at `/login` with an AU mobile (`+61 4XX XXX XXX`)
2. Onboard at `/onboarding` — pick a trade, enter NSW contractor licence (test: `123456C`)
3. Land on `/leads` (the inbox)
4. Tap a lead → `/leads/{id}/photos` → upload site photos + brief context
5. Tap "Generate quote" → wait for AI vision/quote (≤ 60 s)
6. Review on `/quotes/{id}` → tap "Send" → SMS goes to customer
7. Customer opens `/q/{token}` → one-tap accept

End-to-end target: **< 5 minutes** from photo upload to SMS delivered.

## Other useful commands

- `./scripts/quality-gates.sh` — run the full 11-gate quality suite
- `pnpm test:e2e` — Playwright (chromium + mobile-android; set
  `ENABLE_WEBKIT=1` if your host has GTK4 deps)
- `pnpm db:studio` — open Prisma Studio at <http://localhost:5555>
