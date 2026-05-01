#!/usr/bin/env bash
# Apply database schema for QuotingAgent.
#
# Two paths:
#   1. LOCAL DEV (default) — vanilla Postgres + pgvector container.
#      Uses `prisma db push` to sync the Prisma schema directly. Skips RLS
#      policies and Supabase-specific SQL (those matter for hosted Supabase).
#      Trigger: any DATABASE_URL that is NOT *.supabase.co.
#
#   2. HOSTED SUPABASE (production) — runs `supabase/bootstrap.sql` (no-op on
#      hosted Supabase since auth/extensions exist) then applies every
#      supabase/migrations/*.sql in order, tracked in `_supabase_migrations`.
#      Trigger: SUPABASE_MIGRATE=1 in the env, OR DATABASE_URL host matches
#      *.supabase.co.

set -euo pipefail

# Load .env.local if running standalone
if [[ -f .env.local && -z "${DATABASE_URL:-}" ]]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' .env.local | grep -E '^DATABASE_URL=' | xargs -d '\n')
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set. Copy .env.example to .env.local and fill it in." >&2
  exit 1
fi

# Decide which path to take
USE_SUPABASE_MIGRATE=0
if [[ "${SUPABASE_MIGRATE:-0}" == "1" ]]; then
  USE_SUPABASE_MIGRATE=1
elif [[ "$DATABASE_URL" == *supabase.co* ]] || [[ "$DATABASE_URL" == *supabase.com* ]]; then
  USE_SUPABASE_MIGRATE=1
fi

if [[ "$USE_SUPABASE_MIGRATE" == "0" ]]; then
  echo "→ local dev path: bootstrap + prisma db push"
  if [[ -f supabase/bootstrap.sql ]]; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/bootstrap.sql >/dev/null
    echo "  ↳ bootstrap (auth schema + extensions) applied"
  fi
  pnpm prisma db push --skip-generate --accept-data-loss
  echo "✓ schema synced"
  exit 0
fi

# --- Hosted Supabase path ---
echo "→ hosted Supabase path: applying supabase/migrations/*.sql"
PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1)

if [[ -f supabase/bootstrap.sql ]]; then
  echo "  ↳ supabase/bootstrap.sql"
  "${PSQL[@]}" -f supabase/bootstrap.sql >/dev/null
fi

"${PSQL[@]}" -c "CREATE TABLE IF NOT EXISTS public._supabase_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);" >/dev/null

shopt -s nullglob
for f in supabase/migrations/*.sql; do
  name=$(basename "$f")
  applied=$("${PSQL[@]}" -tA -c "SELECT 1 FROM public._supabase_migrations WHERE filename = '$name';")
  if [[ "$applied" == "1" ]]; then
    echo "  ↳ $name (already applied)"
    continue
  fi
  echo "  ↳ applying $name"
  "${PSQL[@]}" -f "$f"
  "${PSQL[@]}" -c "INSERT INTO public._supabase_migrations (filename) VALUES ('$name');" >/dev/null
done

echo "✓ migrations up to date"
