#!/usr/bin/env bash
# Configure a test phone number on a hosted Supabase project so the e2e
# auth-gated tests can sign in with a fixed OTP — no real SMS sent, no
# Twilio cost, no rate limits.
#
# Uses the Supabase Management API (no Supabase CLI install needed).
#
# Usage:
#   SUPABASE_ACCESS_TOKEN=sbp_... \
#   SUPABASE_PROJECT_REF=abcd1234 \
#   E2E_TEST_PHONE=+61400000000 \
#   E2E_TEST_OTP_SECRET=000000 \
#   scripts/setup-supabase-test-phone.sh
#
# What it does:
#   1. Reads the project's auth config (PATCH-friendly schema)
#   2. Sets sms_test_otp = "{phone}:{static_otp}"
#   3. Sets sms_test_otp_valid_until far in the future
#   4. Verifies by GETting the config back
#
# Required env vars:
#   SUPABASE_ACCESS_TOKEN  Personal access token from
#                          https://supabase.com/dashboard/account/tokens
#   SUPABASE_PROJECT_REF   The project ref (visible in the dashboard URL)
#   E2E_TEST_PHONE         AU mobile in E.164 format (+614XXXXXXXX)
#   E2E_TEST_OTP_SECRET    Static 6-digit OTP the test will type (e.g. 000000)

set -euo pipefail

require() {
  if [[ -z "${!1:-}" ]]; then
    echo "ERROR: $1 is required. See script header for details." >&2
    exit 1
  fi
}

require SUPABASE_ACCESS_TOKEN
require SUPABASE_PROJECT_REF
require E2E_TEST_PHONE
require E2E_TEST_OTP_SECRET

# Validate format
if ! [[ "$E2E_TEST_PHONE" =~ ^\+614[0-9]{8}$ ]]; then
  echo "ERROR: E2E_TEST_PHONE must be an AU mobile in E.164 format (+614XXXXXXXX)" >&2
  exit 1
fi
if ! [[ "$E2E_TEST_OTP_SECRET" =~ ^[0-9]{6}$ ]]; then
  echo "ERROR: E2E_TEST_OTP_SECRET must be a 6-digit string" >&2
  exit 1
fi

API="https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/config/auth"
AUTH=(-H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" -H "Content-Type: application/json")

echo "→ verifying token + project access"
status=$(curl -s -o /tmp/supabase-config.json -w "%{http_code}" "${AUTH[@]}" "$API")
if [[ "$status" != "200" ]]; then
  echo "ERROR: GET $API returned HTTP $status" >&2
  cat /tmp/supabase-config.json >&2
  exit 1
fi
echo "  ↳ token + project ok"

# Build the patch body. sms_test_otp format per Management API docs:
#   "{phone}:{otp}" pairs joined by commas (we set just one).
PATCH_BODY=$(jq -n \
  --arg pair "${E2E_TEST_PHONE}:${E2E_TEST_OTP_SECRET}" \
  --arg until "2099-12-31T23:59:59Z" \
  '{ sms_test_otp: $pair, sms_test_otp_valid_until: $until }')

echo "→ PATCH auth config: register test phone"
status=$(curl -s -o /tmp/supabase-patch.json -w "%{http_code}" \
  -X PATCH "${AUTH[@]}" -d "$PATCH_BODY" "$API")
if [[ "$status" != "200" ]]; then
  echo "ERROR: PATCH $API returned HTTP $status" >&2
  cat /tmp/supabase-patch.json >&2
  exit 1
fi

# Verify by reading back
echo "→ verifying"
curl -s "${AUTH[@]}" "$API" \
  | jq '{sms_test_otp, sms_test_otp_valid_until}'

cat <<EOF

✓ Done.

Next:
  1. Add these GitHub repository secrets (Settings → Secrets → Actions):
       E2E_TEST_PHONE       = ${E2E_TEST_PHONE}
       E2E_TEST_OTP_SECRET  = ${E2E_TEST_OTP_SECRET}
       VERCEL_TOKEN         = (from https://vercel.com/account/tokens)
       VERCEL_ORG_ID        = (\`vercel link\` then read .vercel/project.json)
       VERCEL_PROJECT_ID    = (same file)

  2. Push to main (or open a PR) and watch .github/workflows/e2e-preview.yml run.

To remove the test phone later:
  curl -X PATCH "$API" \\
    "\${AUTH[@]}" \\
    -d '{"sms_test_otp": "", "sms_test_otp_valid_until": null}'

EOF
