#!/usr/bin/env bash
# Seed a sample tradie account against the staging Supabase + Neon-via-Supabase DB.
#
# What this creates:
#   1. A Supabase auth user for the test phone (idempotent — OTP-signin if missing)
#   2. A crew record    "Sydney Roofing Co" (NSW licence L001234567, roofer, $95/hr)
#   3. A user record linking auth.users.id → crew.id (role=owner)
#   4. app_metadata.crew_id set on the Supabase auth user (so JWT carries crew_id)
#   5. 5 demo leads (1 won, 1 sent, 3 new) so /leads is not empty
#   6. 1 fully-priced demo quote on one of the leads
#
# Usage:
#   SUPABASE_ACCESS_TOKEN=sbp_... scripts/seed-staging.sh
#
# Env it reads from .env.staging.local:
#   DATABASE_URL                   psql connection string
#   NEXT_PUBLIC_SUPABASE_URL       project URL
#   SUPABASE_SERVICE_ROLE_KEY      bypasses RLS for the inserts
#   E2E_TEST_PHONE                 phone to seed (defaults +61400000000)
#
# Idempotent: re-runs upsert the rows by deterministic UUID keys.

set -euo pipefail

if [[ -f .env.staging.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.staging.local
  set +a
fi

PHONE="${E2E_TEST_PHONE:-+61400000000}"
TEST_OTP="${E2E_TEST_OTP_SECRET:-000000}"

require() {
  if [[ -z "${!1:-}" ]]; then
    echo "ERROR: $1 not set (looked in env + .env.staging.local)" >&2
    exit 1
  fi
}
require DATABASE_URL
require NEXT_PUBLIC_SUPABASE_URL
require SUPABASE_SERVICE_ROLE_KEY
require NEXT_PUBLIC_SUPABASE_ANON_KEY

# ─── 1. Sign in the test phone (creates the auth user if first run) ──────────
echo "→ signing in test phone $PHONE to provision the auth.users row"
curl -sS -X POST "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/otp" \
  -H "Content-Type: application/json" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -d "{\"phone\": \"$PHONE\"}" >/dev/null

VERIFY=$(curl -sS -X POST "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/verify" \
  -H "Content-Type: application/json" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -d "{\"type\": \"sms\", \"phone\": \"$PHONE\", \"token\": \"$TEST_OTP\"}")

USER_ID=$(echo "$VERIFY" | jq -r '.user.id // empty')
if [[ -z "$USER_ID" ]]; then
  echo "ERROR: OTP verify did not return a user.id. Response was:" >&2
  echo "$VERIFY" | jq >&2
  exit 1
fi
echo "  ↳ auth user: $USER_ID"

# ─── 2. Insert crew + user row + leads + quote (RLS-bypass via service role) ─
# Use deterministic UUID5 IDs derived from constant strings so re-runs upsert
# the same rows without duplicates.
CREW_ID=$(python3 -c "import uuid; print(uuid.uuid5(uuid.UUID('00000000-0000-0000-0000-000000000000'), 'staging-sample-crew'))")
LEAD_IDS=()
for i in 1 2 3 4 5; do
  LEAD_IDS+=( "$(python3 -c "import uuid; print(uuid.uuid5(uuid.UUID('00000000-0000-0000-0000-000000000000'), 'staging-sample-lead-$i'))")" )
done
QUOTE_ID=$(python3 -c "import uuid; print(uuid.uuid5(uuid.UUID('00000000-0000-0000-0000-000000000000'), 'staging-sample-quote'))")

echo "→ writing crew + user + leads + quote (psql, RLS-bypass via DATABASE_URL service-role connection)"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
-- Crew
INSERT INTO public.crews (id, business_name, trade_type, nsw_licence_number,
                          licence_verified, licence_verified_at,
                          default_labour_rate_aud, abn, created_at)
VALUES ('$CREW_ID', 'Sydney Roofing Co', 'roofer', 'L001234567',
        true, now(), 95, '12345678901', now())
ON CONFLICT (id) DO UPDATE
  SET business_name           = EXCLUDED.business_name,
      trade_type              = EXCLUDED.trade_type,
      nsw_licence_number      = EXCLUDED.nsw_licence_number,
      default_labour_rate_aud = EXCLUDED.default_labour_rate_aud,
      abn                     = EXCLUDED.abn;

-- User row linking the auth.users.id → crew
INSERT INTO public.users (id, crew_id, phone, role, created_at)
VALUES ('$USER_ID', '$CREW_ID', '$PHONE', 'owner', now())
ON CONFLICT (id) DO UPDATE
  SET crew_id = EXCLUDED.crew_id,
      phone   = EXCLUDED.phone,
      role    = EXCLUDED.role;

-- 5 demo leads (mix of statuses so the tray has something interesting)
INSERT INTO public.leads (id, crew_id, source, customer_name, customer_mobile,
                          address, description, status, created_at)
VALUES
  ('${LEAD_IDS[0]}', '$CREW_ID', 'da', 'Sarah Chen', '+61412345678',
   '24 Westfield Rd, Penrith NSW 2750',
   'Re-roof — 180 m² colorbond, 15 yo concrete tile, single storey',
   'new', now() - interval '2 hours'),
  ('${LEAD_IDS[1]}', '$CREW_ID', 'manual', 'Tom Smith', '+61423456789',
   '8 Main St, Blacktown NSW 2148',
   'Patch + replace 6 broken tiles after the storm', 'new', now() - interval '1 day'),
  ('${LEAD_IDS[2]}', '$CREW_ID', 'da', 'Aisha Patel', '+61434567890',
   '142 Great Western Hwy, Parramatta NSW 2150',
   'Roof inspection + minor leak repair on metal patio cover',
   'new', now() - interval '3 days'),
  ('${LEAD_IDS[3]}', '$CREW_ID', 'manual', 'Mark Williams', '+61445678901',
   '57 Bennelong Pkwy, Doonside NSW 2767',
   'Full re-roof colorbond + 2 skylights, single storey',
   'sent', now() - interval '5 days'),
  ('${LEAD_IDS[4]}', '$CREW_ID', 'da', 'Priya Singh', '+61456789012',
   '12 Glenmore Pkwy, Glenmore Park NSW 2745',
   'Replacement of damaged guttering + downpipe (~32 m total)',
   'won', now() - interval '14 days')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

-- One quote on the "sent" lead
INSERT INTO public.quotes (id, lead_id, crew_id, status,
                           subtotal_aud, gst_aud, total_aud,
                           licence_number_snapshot, licence_verified_snapshot,
                           rate_card_source, sent_at, created_at)
VALUES ('$QUOTE_ID', '${LEAD_IDS[3]}', '$CREW_ID', 'sent',
        11318.18, 1131.82, 12450.00,
        'L001234567', true,
        'live', now() - interval '4 days', now() - interval '5 days')
ON CONFLICT (id) DO UPDATE
  SET status = EXCLUDED.status, total_aud = EXCLUDED.total_aud;

INSERT INTO public.quote_line_items (id, quote_id, kind, description,
                                     qty, unit, unit_price_aud,
                                     confidence_score, sort_order)
VALUES
  ('$(python3 -c "import uuid; print(uuid.uuid5(uuid.UUID(\"00000000-0000-0000-0000-000000000000\"), \"staging-sample-li-1\"))")',
   '$QUOTE_ID', 'material', 'Colorbond Trimdek 0.42mm — 180 m²',
   180, 'm2', 28.50, 90, 1),
  ('$(python3 -c "import uuid; print(uuid.uuid5(uuid.UUID(\"00000000-0000-0000-0000-000000000000\"), \"staging-sample-li-2\"))")',
   '$QUOTE_ID', 'material', 'Skylights — 2 × 1200×600 fixed',
   2, 'each', 690.00, 85, 2),
  ('$(python3 -c "import uuid; print(uuid.uuid5(uuid.UUID(\"00000000-0000-0000-0000-000000000000\"), \"staging-sample-li-3\"))")',
   '$QUOTE_ID', 'labour', 'Roof tear-off + install — 2 days × 4 hands',
   64, 'hr', 95.00, 95, 3)
ON CONFLICT (id) DO NOTHING;
SQL

echo "  ↳ DB seed done"

# ─── 3. Set app_metadata.crew_id on the Supabase auth user ───────────────────
echo "→ setting app_metadata.crew_id on auth user (so JWT carries crew_id)"
RESULT=$(curl -sS -X PUT \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/admin/users/$USER_ID" \
  -d "{\"app_metadata\": {\"crew_id\": \"$CREW_ID\", \"provider\": \"phone\"}}")
echo "$RESULT" | jq '{id, phone, app_metadata}' 2>/dev/null || echo "$RESULT"

cat <<EOF

✓ Sample tradie account ready.

  phone:    $PHONE
  test OTP: $TEST_OTP
  user_id:  $USER_ID
  crew_id:  $CREW_ID
  business: Sydney Roofing Co (roofer, NSW licence L001234567)

Sign in flow on the deployed app:
  1. Open ${NEXT_PUBLIC_APP_URL:-<URL>}/login
  2. Enter $PHONE
  3. (No real SMS — Supabase test_otp returns immediately)
  4. Enter the OTP $TEST_OTP
  5. Lands on /leads with 5 leads (1 won, 1 sent, 3 new) and 1 quote.

Re-run any time — script is idempotent (deterministic UUIDs + ON CONFLICT).
EOF
