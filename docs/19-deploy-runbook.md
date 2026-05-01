# Deploy runbook

Two-environment model:

- **staging** — `.env.staging.local` → Vercel preview project → Stripe TEST keys, Supabase stub OK
- **production** — `.env.production.local` → Vercel production project → Stripe LIVE keys, real Supabase required

All operations go through `scripts/deploy.sh <env> <subcommand>`. The script
is idempotent: re-running any step overwrites cleanly.

## Quick reference

```bash
scripts/deploy.sh staging preflight   # check tooling + env file + vercel auth
scripts/deploy.sh staging link        # one-time: create Vercel project, write IDs back into .env
scripts/deploy.sh staging unprotect   # disable Vercel SSO gate (staging only)
scripts/deploy.sh staging env-up      # push every var in .env.staging.local to Vercel preview scope
scripts/deploy.sh staging deploy      # vercel deploy + write deployed URL back into .env
scripts/deploy.sh staging smoke       # curl 7 critical routes against the deployed URL
scripts/deploy.sh staging all         # preflight → link → env-up → deploy (skips smoke)
```

`production` works the same way but `deploy` and `env-up` prompt for `yes`
confirmation, push to the `production` Vercel scope, and never auto-disable
protection.

## Prerequisites

| Thing | Where it comes from |
|---|---|
| Vercel CLI auth | `vercel login` (one-time per machine) — token stored at `~/.local/share/com.vercel.cli/auth.json` |
| Postgres + pgvector | A Neon project (recommended) or hosted Supabase. Connection string with `?sslmode=require` |
| Anthropic key | <https://console.anthropic.com/settings/keys> |
| Twilio account | SID + Auth Token + an AU long-code or trial number |
| Resend key | optional; email fallback when SMS fails |
| Sentry DSN | optional but recommended |
| PostHog key | optional; gates the wedge funnel until cookie consent |
| Upstash Redis | optional in staging (no-op limiter); **required in production** |
| Supabase project | optional in staging (stubbed); **required in production** for phone-OTP auth |

## First-time staging deploy (8 minutes)

### 1. Build the env file

```bash
cp .env.example .env.staging.local
```

Fill in real values (see the table above for what each one is for). At
minimum, the deploy refuses to proceed without these eight:

```
NEXT_PUBLIC_APP_URL DATABASE_URL ANTHROPIC_API_KEY
TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_PHONE_NUMBER
HMAC_SECRET FSM_TOKEN_ENCRYPTION_KEY
```

> **Quote the `DATABASE_URL`.** Bash's `source` command treats unquoted `&`
> as a backgrounding operator and silently truncates the value. Always wrap
> in double quotes:
>
> ```
> DATABASE_URL="postgresql://...?sslmode=require&schema=quotingagent"
> ```

### 2. Apply the schema to your DB

```bash
set -a; source .env.staging.local; set +a
CLEAN_URL=$(echo "$DATABASE_URL" | sed 's/[?&]schema=quotingagent//')

# bootstrap creates the auth schema, auth.uid() stub, extensions schema,
# and supabase roles (anon/authenticated/service_role). All idempotent.
psql "$CLEAN_URL" -v ON_ERROR_STOP=1 -f supabase/bootstrap.sql

# prisma db push creates the 21 tables in the quotingagent schema.
pnpm prisma db push --skip-generate --accept-data-loss
```

The `&schema=quotingagent` query param routes Prisma to a dedicated
Postgres schema so PI-AU (or any other tenant on the same DB) is never
touched.

### 3. Provision + deploy

```bash
scripts/deploy.sh staging preflight     # green if env file is good
scripts/deploy.sh staging link          # creates the Vercel project, writes IDs into .env, disables protection
scripts/deploy.sh staging env-up        # pushes 19 env vars to Vercel preview scope
scripts/deploy.sh staging deploy        # vercel deploy
sleep 60                                 # wait for Vercel build
scripts/deploy.sh staging smoke         # 7/7 should be 200
```

Or in one shot: `scripts/deploy.sh staging all && sleep 60 && scripts/deploy.sh staging smoke`.

### 4. Post-deploy

The deploy step writes the live preview URL back into
`.env.staging.local#NEXT_PUBLIC_APP_URL`, so the next `env-up` will push
the canonical URL into Vercel and self-references in `<a href>` /
`fetch()` will be correct on the second deploy.

## Three runtime gotchas (and the fixes already in the repo)

These were discovered on the first staging deploy and the repo now ships
with the fixes. Documenting them so future deploys against new providers
don't re-trip the same wires.

### Gotcha 1: `ALTER DATABASE` hardcoded a DB name

`supabase/bootstrap.sql` originally said:

```sql
ALTER DATABASE quotingagent SET search_path TO public, extensions;
```

That worked against the local Docker container (DB literally named
`quotingagent`) but broke against Neon (`neondb`) and hosted Supabase
(`postgres`).

Fix: wrapped in a `DO` block using `current_database()` plus an
`insufficient_privilege` exception handler so it's a no-op on managed
Postgres where the role can't ALTER DATABASE.

### Gotcha 2: pgvector schema pin

`prisma/schema.prisma` originally said:

```prisma
extensions = [pgvector(map: "vector", schema: "extensions")]
```

Prisma compared that to the live DB, found pgvector in `public` (where
Neon installs it), and tried `ALTER EXTENSION vector SET SCHEMA extensions`.
A non-superuser can't do that, so the deploy failed.

Fix: dropped the `schema:` constraint. pgvector works regardless of which
schema it lives in because Prisma references the type via search_path.

### Gotcha 3: Upstash hard-crash at module import

`src/lib/services/rate-limit.ts` originally threw at import time when
`UPSTASH_REDIS_REST_URL` was missing AND `NODE_ENV === "production"`.
Vercel sets `NODE_ENV=production` for every build (including staging
previews), so the build crashed before page collection.

Fix: the production guard now checks `STAGE !== "staging"` too, so staging
falls back to the no-op limiter while production keeps the hard-fail.

## Vercel SSO/password protection

Vercel's default for new projects is "All Deployments" SSO-gated. Curling
the preview URL returns `401 Authentication Required` until disabled.

`scripts/deploy.sh staging link` automatically calls
`scripts/deploy.sh staging unprotect` after creating the project, which
hits the Vercel Management API:

```bash
curl -X PATCH \
  "https://api.vercel.com/v9/projects/${PROJECT_ID}?teamId=${TEAM_ID}" \
  -H "Authorization: Bearer ${VERCEL_TOKEN}" \
  -d '{"ssoProtection": null, "passwordProtection": null}'
```

To re-enable manually: dashboard → project → Settings → Deployment Protection.

For **production** the script does **not** auto-unprotect — that's a
deliberate choice you make in the dashboard once you have a custom
domain.

## Sample tradie account (staging)

Once the deploy is green and Supabase phone auth is wired, you can seed a
fully-populated demo account so clicking through `/login → /onboarding →
/leads` lands on a populated inbox instead of an empty state.

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...
scripts/seed-staging.sh
```

What it creates (idempotent — re-runs upsert via deterministic UUID5 keys):

| Surface | Record |
|---|---|
| Supabase auth | user for `+61400000000` (created on first OTP verify) |
| `public.crews` | "Sydney Roofing Co" — roofer, NSW licence `L001234567` (marked verified), $95/hr labour, ABN `12345678901` |
| `public.users` | links the auth user → crew, role `owner` |
| Supabase `app_metadata.crew_id` | set on the auth user so the JWT carries `crew_id` (RLS scoping works) |
| `public.leads` | 5 leads — 1 `won`, 1 `sent`, 3 `new` (mix of DA + manual sources, 2h–14d old) |
| `public.quotes` | 1 sent quote (A$12,450 incl. GST) on the `sent` lead |
| `public.quote_line_items` | 3 lines on that quote (Colorbond / skylights / labour) |

### Sign-in walkthrough

1. Visit `${NEXT_PUBLIC_APP_URL}/login`
2. Enter `+61400000000` — no real SMS sent (Supabase `sms_test_otp`)
3. Enter the static OTP `000000`
4. App routes you to `/leads` (not `/onboarding`, because `crew_id` is
   already in `app_metadata`)
5. The Leads tab shows 5 cards with the seeded data; the Quotes tab
   shows the sent quote

### Account credentials

| Field | Value |
|---|---|
| Phone | `+61400000000` |
| Test OTP | `000000` |
| `auth.users.id` | `fc3159e5-bd11-4ad8-b844-ec19bdd06970` |
| `crews.id` | `a4cdf6f3-5464-5a55-80b9-098d29b86675` |
| Business name | Sydney Roofing Co |
| Trade type | roofer |
| NSW licence | L001234567 (marked verified at seed time) |

Both UUIDs are deterministic UUID5 values derived from constant strings
(`staging-sample-crew`, `staging-sample-lead-1..5`, `staging-sample-quote`,
`staging-sample-li-1..3`), so re-running the seed never duplicates rows.

### Removing the sample account

```bash
psql "$DATABASE_URL" -c "
  DELETE FROM public.crews WHERE id = 'a4cdf6f3-5464-5a55-80b9-098d29b86675';
  -- Cascades to users, leads, quotes, line_items, etc.
"
# Optional: also delete the auth user via Admin API
curl -X DELETE \
  -H \"apikey: \$SUPABASE_SERVICE_ROLE_KEY\" \
  -H \"Authorization: Bearer \$SUPABASE_SERVICE_ROLE_KEY\" \
  \"\$NEXT_PUBLIC_SUPABASE_URL/auth/v1/admin/users/fc3159e5-bd11-4ad8-b844-ec19bdd06970\"
```

### Production note

`sms_test_otp` is a **back door** — anyone who knows `+61400000000`
+ `000000` signs in as the demo crew. Before pointing real users at this
deploy, clear it:

```bash
curl -X PATCH \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/config/auth" \
  -d '{"sms_test_otp": "", "sms_test_otp_valid_until": null}'
```

## Upgrading from staging stubs to real services

The first deploy uses two stubs that need replacing before the wedge
flow actually works end-to-end:

### Real Supabase (unlocks phone-OTP sign-in)

1. Create a Supabase project (any region; `ap-southeast-2` matches the
   Neon region for lowest latency).
2. Update `.env.staging.local`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc... (real)
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...   (real)
   ```

3. Apply the production-grade migrations (with RLS + RPCs) — set
   `SUPABASE_MIGRATE=1` so `db-migrate.sh` takes the hosted-Supabase
   path instead of `prisma db push`:

   ```bash
   SUPABASE_MIGRATE=1 \
   DATABASE_URL="postgresql://postgres:PWD@db.PROJECT.supabase.co:5432/postgres" \
     pnpm db:migrate:deploy
   ```

4. Register the e2e test phone (skip for production):

   ```bash
   SUPABASE_ACCESS_TOKEN=sbp_... \
   SUPABASE_PROJECT_REF=xxxx \
   E2E_TEST_PHONE=+61400000000 \
   E2E_TEST_OTP_SECRET=000000 \
     scripts/setup-supabase-test-phone.sh
   ```

5. Re-run `scripts/deploy.sh staging env-up && scripts/deploy.sh staging deploy`.

### Wire phone-OTP via Twilio Verify

Twilio Verify is purpose-built for OTPs (free quota, no phone number needed,
works on trial Twilio accounts). Set it up once with the Management API:

```bash
# 1. Create a Twilio Verify Service (free, no phone number purchase required)
TW_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TW_TOKEN="your-twilio-auth-token"
VERIFY_SID=$(curl -sS -u "$TW_SID:$TW_TOKEN" \
  -X POST "https://verify.twilio.com/v2/Services" \
  --data-urlencode "FriendlyName=QuotingAgent OTP" \
  --data-urlencode "CodeLength=6" | jq -r '.sid')

# 2. Wire it into Supabase auth config (note the field name —
#    sms_twilio_verify_message_service_sid, NOT sms_twilio_verify_service_sid)
curl -sS -X PATCH \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/config/auth" \
  -d "{
    \"external_phone_enabled\": true,
    \"sms_provider\": \"twilio_verify\",
    \"sms_twilio_verify_account_sid\": \"$TW_SID\",
    \"sms_twilio_verify_auth_token\": \"$TW_TOKEN\",
    \"sms_twilio_verify_message_service_sid\": \"$VERIFY_SID\",
    \"sms_otp_length\": 6,
    \"sms_otp_exp\": 600
  }"
```

After this, `POST /api/auth/otp` on the deployed app actually sends an
OTP via Twilio Verify (or returns the static one if the phone is in
`sms_test_otp`).

### Real Upstash (required for production traffic)

1. Create a Redis instance at <https://console.upstash.com>. Region:
   `ap-southeast-2` (matches the deploy region).
2. Add to `.env.staging.local`:

   ```
   UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
   UPSTASH_REDIS_REST_TOKEN=Aa...
   ```

3. `scripts/deploy.sh staging env-up && scripts/deploy.sh staging deploy`.

The factory in `src/lib/services/rate-limit.ts` switches off the no-op
fallback the moment both env vars are present.

## Production deploy

Same script, different env file + extra confirmation.

```bash
cp .env.staging.local .env.production.local
# replace test keys with live ones (Stripe sk_live_, real Supabase, real Twilio)
# point DATABASE_URL at a separate production DB

scripts/deploy.sh production preflight
scripts/deploy.sh production all       # prompts: type 'yes' to continue
scripts/deploy.sh production smoke
```

Production differences enforced by the script:

- Confirmation prompt before `env-up` and `deploy`.
- env-up pushes to the `production` Vercel scope (not `preview`).
- `deploy` adds `--prod` so the project's stable domain (`<name>.vercel.app`
  or your custom domain) is updated, not just a preview URL.
- `unprotect` is **not** auto-called.

## Smoke checks

`scripts/deploy.sh <env> smoke` curls these and expects 200:

```
/                     marketing landing
/login                phone-OTP screen
/onboarding           crew + NSW licence capture
/privacy              legal page
/terms                legal page
/manifest.json        PWA manifest
/icons/icon-192.png   PWA icon
```

If any fail with `401`, deployment protection is still on — re-run
`unprotect`. If they fail with `500`, check Vercel build logs (most
likely cause: a missing env var that wasn't pushed by `env-up`).

## Rollback

Vercel keeps every deployment forever. To roll back:

```bash
vercel ls quotingagent --token=$VERCEL_TOKEN | head -10
vercel promote <deployment-url> --token=$VERCEL_TOKEN
```

For the database, there's no automatic snapshot. Neon has point-in-time
recovery in the dashboard (Settings → Branches → Restore from time).
For schema-level rollback, `prisma migrate diff` against the previous
schema + `psql -f` the resulting SQL.

## Repo state after a clean staging deploy

| File | What it holds |
|---|---|
| `.env.staging.local` (gitignored) | All staging creds + the live `VERCEL_PROJECT_ID` + the deployed URL |
| `.vercel/project.json` (gitignored) | Same project ID, used as fallback when env file is missing |
| `state/state.json` | Pipeline state for build-product-v2; not touched by deploys |

## When to update this runbook

- A new required env var is added → bump `REQUIRED_VARS` in
  `scripts/deploy.sh` AND mention it under "Prerequisites" here.
- A new external service is wired (e.g. Stripe, Cloudflare R2) → add an
  "Upgrading from staging stubs" subsection.
- A new gotcha trips the deploy → add it to "Three runtime gotchas" and
  rename the section accordingly.
