# GitHub Actions setup — `e2e-preview` workflow

This workflow runs the full Playwright suite (including auth-gated tests)
against a Vercel preview deploy on every PR and push to `main`.

## One-time setup

### 1. Create the test phone in Supabase

Pick an AU mobile number you control (or any E.164 number). It does **not**
need to receive SMS — the static OTP is what the test will type.

```bash
SUPABASE_ACCESS_TOKEN=sbp_xxx \
SUPABASE_PROJECT_REF=abcd1234 \
E2E_TEST_PHONE=+61400000000 \
E2E_TEST_OTP_SECRET=000000 \
  scripts/setup-supabase-test-phone.sh
```

Where:

- `SUPABASE_ACCESS_TOKEN` — personal access token from
  <https://supabase.com/dashboard/account/tokens>
- `SUPABASE_PROJECT_REF` — visible in your project's dashboard URL
- `E2E_TEST_PHONE` / `E2E_TEST_OTP_SECRET` — your choice

Verify in the dashboard: Authentication → Phone Provider → Test phone numbers.

### 2. Get Vercel project IDs

From the repo root, link the project once:

```bash
pnpm exec vercel link
cat .vercel/project.json
# { "orgId": "team_xxx", "projectId": "prj_xxx" }
```

### 3. Add GitHub repository secrets

`Settings → Secrets and variables → Actions → New repository secret`:

| Name | Value |
|---|---|
| `VERCEL_TOKEN` | <https://vercel.com/account/tokens> |
| `VERCEL_ORG_ID` | from `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | from `.vercel/project.json` |
| `E2E_TEST_PHONE` | same value as step 1 |
| `E2E_TEST_OTP_SECRET` | same value as step 1 |

> Vercel project env vars (`DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_*`,
> `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `TWILIO_*`) are configured
> in the Vercel dashboard, not in GitHub. The workflow runs `vercel pull` to
> fetch them at deploy time.

## What the workflow does

```
[push or PR]
   ↓
checkout + install (cached) + Playwright chromium
   ↓
vercel pull / build / deploy --prebuilt   →  preview URL
   ↓
wait for preview to 200
   ↓
playwright test --project=desktop-chrome
   (with E2E_TEST_PHONE + SECRET + SKIP_WEB_SERVER + E2E_PROD_BUILD set)
   ↓
upload playwright-report/ as artifact
   ↓
on PR: comment the preview URL + status
```

Run-time: ~6–10 minutes per push. Concurrency-grouped per branch so
duplicate pushes cancel earlier runs.

## Manual trigger against an existing URL

`Actions → E2E against Vercel preview → Run workflow → base_url=…`

Skips the deploy step and just tests the URL you give it. Useful for
ad-hoc verification of a hand-deployed preview or production.

## Local dry-run (no Vercel needed)

```bash
pnpm run dev                                     # in one terminal
pnpm test:e2e:auth                               # in another
```

The script reads `E2E_TEST_PHONE` / `E2E_TEST_OTP_SECRET` from `.env.local`
or your shell, and only runs `auth.spec.ts` + `error-states.spec.ts` +
`navigation.spec.ts`. Useful before pushing to confirm the gates flip
correctly.

## Troubleshooting

**"Preview did not respond with 200 within 5 minutes"** — Vercel build is
failing. Check the build logs in Vercel dashboard; usually a missing env
var (`DATABASE_URL`, `ANTHROPIC_API_KEY`).

**Auth tests still skipped** — secrets aren't reaching the job. Check
`Actions → run → Set up job → env`. Common cause: a typo or the secret
was added at org level instead of repo level.

**OTP test fails with "invalid code"** — the test phone wasn't registered
in Supabase, or the value drifted. Re-run `setup-supabase-test-phone.sh`.

**`pnpm exec vercel pull` fails with "no project linked"** — the
`VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` env pair isn't set; the workflow
reads them as job-level env (top of the YAML).
