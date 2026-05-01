#!/usr/bin/env bash
# Run the auth-gated Playwright suite locally.
#
# These tests are skipped by default (test.skip(!hasAuthEnv())). Run them
# locally to dry-run what CI will execute against a Vercel preview.
#
# Two modes:
#
#   1. Against a running local dev server (default):
#      pnpm test:e2e:auth
#      Requires `pnpm run dev` to already be running on :3000 with a real
#      Supabase project (or with E2E_TEST_PHONE configured in your local
#      Supabase test_otp config — see scripts/setup-supabase-test-phone.sh).
#
#   2. Against a deployed preview URL:
#      PLAYWRIGHT_BASE_URL=https://your-preview.vercel.app pnpm test:e2e:auth
#
# Required env vars (load from .env.local automatically if present):
#   E2E_TEST_PHONE       AU mobile that's registered as a test phone in Supabase
#   E2E_TEST_OTP_SECRET  Static 6-digit OTP that pairs with the phone
#
# Optional:
#   E2E_PROD_BUILD       "1" to also run dev-mode-skipped tests (CSP-strict path)
#   ENABLE_WEBKIT        "1" to also run mobile-safari (needs GTK4 etc.)

set -euo pipefail

# Load .env.local if present (so users don't have to export every time)
if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source <(grep -E '^(E2E_TEST_PHONE|E2E_TEST_OTP_SECRET|PLAYWRIGHT_BASE_URL|E2E_PROD_BUILD|ENABLE_WEBKIT)=' .env.local || true)
  set +a
fi

if [[ -z "${E2E_TEST_PHONE:-}" || -z "${E2E_TEST_OTP_SECRET:-}" ]]; then
  cat >&2 <<EOF
ERROR: E2E_TEST_PHONE and E2E_TEST_OTP_SECRET must be set.

Either:
  - export them in your shell, or
  - add to .env.local:
      E2E_TEST_PHONE=+61400000000
      E2E_TEST_OTP_SECRET=000000
  - then run: scripts/setup-supabase-test-phone.sh to register them with
    your Supabase project.

(Without these, the OTP / onboarding / RLS tests test.skip() — that's
why \`pnpm test:e2e\` shows ~200 skipped.)
EOF
  exit 1
fi

# When the user gives us a remote URL, don't have Playwright spawn its own
# dev server (the deployed app is already running there).
if [[ -n "${PLAYWRIGHT_BASE_URL:-}" ]]; then
  export SKIP_WEB_SERVER=1
  echo "→ testing against $PLAYWRIGHT_BASE_URL"
else
  echo "→ testing against http://localhost:3000 (must be running)"
fi

# Filter to just the auth-gated specs; the rest already pass without these
# envs and we don't want to re-run them.
PROJECT="${PLAYWRIGHT_PROJECT:-desktop-chrome}"
echo "→ project: $PROJECT"
echo "→ phone:   ${E2E_TEST_PHONE}"

exec pnpm exec playwright test \
  --project="$PROJECT" \
  e2e/auth.spec.ts \
  e2e/error-states.spec.ts \
  e2e/navigation.spec.ts \
  --reporter=list,html
