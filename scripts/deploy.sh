#!/usr/bin/env bash
# QuotingAgent deploy automation. Two-environment model:
#   - staging:    .env.staging.local    → Vercel staging project   → Stripe TEST
#   - production: .env.production.local → Vercel production project → Stripe LIVE
#
# Adapted from ~/ProjectIntelligence/scripts/deploy.sh.
#
# Usage:
#   scripts/deploy.sh <env> <subcommand>
#   <env>:        staging | production
#   <subcommand>: preflight | link | env-up | deploy | smoke | all | help

set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# ─── Colours ─────────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
else
  GREEN=''; YELLOW=''; RED=''; CYAN=''; BOLD=''; NC=''
fi
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}!${NC} $*"; }
err()  { echo -e "${RED}✗${NC} $*" >&2; }
info() { echo -e "${CYAN}→${NC} $*"; }

# ─── Required + optional vars (preflight) ────────────────────────────────────
REQUIRED_VARS=(
  NEXT_PUBLIC_APP_URL
  DATABASE_URL
  ANTHROPIC_API_KEY
  TWILIO_ACCOUNT_SID
  TWILIO_AUTH_TOKEN
  TWILIO_PHONE_NUMBER
  HMAC_SECRET
  FSM_TOKEN_ENCRYPTION_KEY
)

OPTIONAL_VARS=(
  RESEND_API_KEY
  CRON_SECRET
  SENTRY_DSN
  NEXT_PUBLIC_SENTRY_DSN
  NEXT_PUBLIC_POSTHOG_KEY
  NEXT_PUBLIC_POSTHOG_HOST
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  UPSTASH_REDIS_REST_URL
  UPSTASH_REDIS_REST_TOKEN
)

# ─── Env target dispatch ─────────────────────────────────────────────────────
ENV_TARGET="${1:-}"
SUBCOMMAND="${2:-help}"

case "$ENV_TARGET" in
  staging)
    ENV_FILE=".env.staging.local"
    ENV_LABEL="STAGING"
    REQUIRES_CONFIRM=0
    ;;
  production)
    ENV_FILE=".env.production.local"
    ENV_LABEL="PRODUCTION"
    REQUIRES_CONFIRM=1
    ;;
  ""|help|-h|--help)
    SUBCOMMAND="help"
    ENV_TARGET=""
    ;;
  *)
    err "first argument must be 'staging' or 'production' (got: '$ENV_TARGET')"
    SUBCOMMAND="help"
    ENV_TARGET=""
    ;;
esac

# ─── Vercel CLI wrapper (uses npx if no global) ──────────────────────────────
vc() {
  if command -v vercel >/dev/null 2>&1; then
    vercel "$@"
  else
    npx --yes vercel@latest "$@"
  fi
}

load_vercel_target() {
  if [[ -f "$ENV_FILE" ]]; then
    local pid orgid
    pid=$(awk -F= '/^VERCEL_PROJECT_ID=/ {print $2}' "$ENV_FILE" | tr -d '"' | head -1)
    orgid=$(awk -F= '/^VERCEL_ORG_ID=/ {print $2}' "$ENV_FILE" | tr -d '"' | head -1)
    [[ -n "$pid"   ]] && export VERCEL_PROJECT_ID="$pid"
    [[ -n "$orgid" ]] && export VERCEL_ORG_ID="$orgid"
  fi
}

confirm_or_abort() {
  (( REQUIRES_CONFIRM == 1 )) || return 0
  echo -e "${BOLD}${RED}⚠  ${ENV_LABEL} target.${NC} About to run '${SUBCOMMAND}' against $ENV_FILE."
  read -r -p "Type 'yes' to continue: " confirmation
  if [[ "$confirmation" != "yes" ]]; then
    err "aborted (confirmation required for $ENV_LABEL)"
    exit 1
  fi
}

# ─── Subcommands ─────────────────────────────────────────────────────────────

cmd_preflight() {
  info "[$ENV_LABEL] preflight: tooling + creds + env file"
  local fail=0

  if ! vc --version >/dev/null 2>&1; then
    err "vercel CLI not available (tried local + npx)"
    fail=1
  else
    ok "vercel CLI: $(vc --version 2>/dev/null | head -1)"
  fi

  if ! vc whoami >/dev/null 2>&1; then
    err "vercel: not logged in. Run: vercel login"
    fail=1
  else
    ok "vercel: logged in as $(vc whoami 2>/dev/null)"
  fi

  if [[ ! -f "$ENV_FILE" ]]; then
    err "$ENV_FILE not found"
    fail=1
  else
    set -a; # shellcheck disable=SC1090
    source "$ENV_FILE"; set +a
    local missing=()
    for v in "${REQUIRED_VARS[@]}"; do
      if [[ -z "${!v:-}" ]]; then missing+=("$v"); fi
    done
    if (( ${#missing[@]} > 0 )); then
      err "$ENV_FILE missing required values: ${missing[*]}"
      fail=1
    else
      ok "$ENV_FILE: ${#REQUIRED_VARS[@]}/${#REQUIRED_VARS[@]} required vars set"
    fi
    local missing_opt=()
    for v in "${OPTIONAL_VARS[@]}"; do
      if [[ -z "${!v:-}" ]]; then missing_opt+=("$v"); fi
    done
    if (( ${#missing_opt[@]} > 0 )); then
      warn "optional vars unset: ${missing_opt[*]}"
    fi
  fi

  if [[ ! -f vercel.json ]]; then
    err "vercel.json not found at project root"
    fail=1
  else
    ok "vercel.json present"
  fi

  (( fail == 0 )) || { err "preflight failed"; exit 1; }
  ok "preflight passed"
}

cmd_link() {
  info "[$ENV_LABEL] linking to a Vercel project"
  if [[ -n "${VERCEL_PROJECT_ID:-}" ]]; then
    ok "VERCEL_PROJECT_ID set in $ENV_FILE — no .vercel/ link needed"
    return 0
  fi
  if [[ -d .vercel ]]; then
    ok "already linked (.vercel/ exists)"
    return 0
  fi
  vc link --yes
  ok "linked"
  if [[ -f .vercel/project.json ]]; then
    local pid orgid
    pid=$(awk -F'"' '/projectId/ {print $4}' .vercel/project.json)
    orgid=$(awk -F'"' '/orgId/ {print $4}' .vercel/project.json)
    info "writing VERCEL_PROJECT_ID + VERCEL_ORG_ID into $ENV_FILE"
    # Idempotent: replace existing values, append if missing
    if grep -q "^VERCEL_PROJECT_ID=" "$ENV_FILE"; then
      sed -i "s|^VERCEL_PROJECT_ID=.*|VERCEL_PROJECT_ID=$pid|" "$ENV_FILE"
    else
      echo "VERCEL_PROJECT_ID=$pid" >> "$ENV_FILE"
    fi
    if grep -q "^VERCEL_ORG_ID=" "$ENV_FILE"; then
      sed -i "s|^VERCEL_ORG_ID=.*|VERCEL_ORG_ID=$orgid|" "$ENV_FILE"
    else
      echo "VERCEL_ORG_ID=$orgid" >> "$ENV_FILE"
    fi
    ok "$ENV_FILE updated"
  fi
  # For staging: disable SSO/password protection so the preview is publicly
  # reachable (no Vercel-account-only gate). Production keeps whatever the
  # dashboard has configured.
  if [[ "$ENV_LABEL" == "STAGING" ]]; then
    cmd_unprotect
  fi
}

# Disable SSO + password protection for the linked project (staging only by
# default; safe to call against production but it'll surface a warning).
cmd_unprotect() {
  if [[ "$ENV_LABEL" != "STAGING" ]]; then
    warn "unprotect on PRODUCTION — re-enable in dashboard if this isn't intended"
  fi
  local token_path="${HOME}/.local/share/com.vercel.cli/auth.json"
  if [[ ! -f "$token_path" ]]; then
    warn "vercel CLI token file not at $token_path; skipping unprotect"
    warn "→ disable manually: dashboard → project → Settings → Deployment Protection"
    return 0
  fi
  local token pid orgid
  token=$(jq -r '.token' "$token_path")
  pid="${VERCEL_PROJECT_ID:-$(jq -r '.projectId' .vercel/project.json 2>/dev/null)}"
  orgid="${VERCEL_ORG_ID:-$(jq -r '.orgId' .vercel/project.json 2>/dev/null)}"
  if [[ -z "$pid" || -z "$orgid" ]]; then
    warn "missing project/org IDs; skipping unprotect"
    return 0
  fi
  info "[$ENV_LABEL] disabling SSO + password protection"
  local result
  result=$(curl -sS -X PATCH \
    "https://api.vercel.com/v9/projects/${pid}?teamId=${orgid}" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    -d '{"ssoProtection": null, "passwordProtection": null}')
  if echo "$result" | jq -e '.ssoProtection == null and .passwordProtection == null' >/dev/null 2>&1; then
    ok "protection disabled — preview URL is now publicly accessible"
  else
    warn "unprotect API call may have failed; response: $result"
  fi
}

cmd_env_up() {
  info "[$ENV_LABEL] syncing env vars to Vercel"
  if [[ -z "${VERCEL_PROJECT_ID:-}" ]] && [[ ! -d .vercel ]]; then
    err "not linked. Run: scripts/deploy.sh $ENV_TARGET link"
    exit 1
  fi
  confirm_or_abort

  set -a; # shellcheck disable=SC1090
  source "$ENV_FILE"; set +a

  # Choose Vercel scope — staging defaults to "preview", production to "production"
  local scope
  if [[ "$ENV_LABEL" == "PRODUCTION" ]]; then
    scope="production"
  else
    scope="preview"
  fi
  info "Vercel env scope: $scope"

  local pushed=0 skipped=0
  while IFS= read -r v; do
    local val="${!v:-}"
    if [[ -z "$val" ]]; then ((skipped+=1)); continue; fi
    # Idempotent: remove first (silently), then add. Pipe value via stdin.
    vc env rm "$v" "$scope" --yes >/dev/null 2>&1 || true
    printf '%s' "$val" | vc env add "$v" "$scope" >/dev/null 2>&1 || {
      warn "  failed to push $v (will skip)"; continue;
    }
    echo "  pushed $v"
    ((pushed+=1))
  done < <(awk -F= '
    /^[[:space:]]*#/ || /^[[:space:]]*$/ { next }
    /^[A-Za-z_][A-Za-z0-9_]*=/ {
      name = $1
      if (name ~ /^VERCEL_/) next   # Vercel-managed
      print name
    }
  ' "$ENV_FILE" | sort -u)
  ok "env-up done — $pushed pushed, $skipped skipped (empty)"
}

cmd_deploy() {
  info "[$ENV_LABEL] deploying"
  if [[ -z "${VERCEL_PROJECT_ID:-}" ]] && [[ ! -d .vercel ]]; then
    err "not linked. Run: scripts/deploy.sh $ENV_TARGET link"
    exit 1
  fi
  confirm_or_abort

  local deploy_args=()
  if [[ "$ENV_LABEL" == "PRODUCTION" ]]; then
    deploy_args+=(--prod)
  fi
  deploy_args+=(--yes)

  # Capture the deployment URL
  local url
  url=$(vc deploy "${deploy_args[@]}")
  ok "deploy URL: $url"

  # Persist the URL back into the env file so smoke tests can pick it up
  if [[ -n "$url" ]]; then
    if grep -q "^NEXT_PUBLIC_APP_URL=" "$ENV_FILE"; then
      sed -i "s|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=$url|" "$ENV_FILE"
    else
      echo "NEXT_PUBLIC_APP_URL=$url" >> "$ENV_FILE"
    fi
    ok "NEXT_PUBLIC_APP_URL=$url written to $ENV_FILE"
  fi
}

cmd_smoke() {
  info "[$ENV_LABEL] smoke tests"
  set -a; # shellcheck disable=SC1090
  source "$ENV_FILE"; set +a
  local url="${NEXT_PUBLIC_APP_URL:-}"
  if [[ -z "$url" ]]; then
    err "NEXT_PUBLIC_APP_URL not set in $ENV_FILE"
    exit 1
  fi
  url="${url%/}"
  info "target: $url"

  local fail=0
  check() {
    local path="$1" expected="$2" desc="${3:-$1}"
    local got
    got=$(curl -sL -o /dev/null -w '%{http_code}' "$url$path" || echo "000")
    if [[ "$got" == "$expected" ]]; then
      ok "$desc → $got"
    else
      err "$desc → $got (expected $expected)"
      fail=1
    fi
  }

  check "/" 200 "marketing landing"
  check "/login" 200 "login page"
  check "/onboarding" 200 "onboarding"
  check "/privacy" 200 "privacy"
  check "/terms" 200 "terms"
  check "/manifest.json" 200 "PWA manifest"
  check "/icons/icon-192.png" 200 "PWA icon"

  (( fail == 0 )) || { err "smoke tests failed"; exit 1; }
  ok "smoke tests passed"
}

cmd_all() {
  cmd_preflight
  cmd_link
  cmd_env_up
  cmd_deploy
  echo
  warn "wait ~60s for Vercel build, then run: scripts/deploy.sh $ENV_TARGET smoke"
}

cmd_help() {
  cat <<EOF
QuotingAgent deploy — staging + production automation.

Usage: scripts/deploy.sh <env> <subcommand>

  <env>: staging | production

Subcommands:
  preflight   verify CLI + auth + env file + vercel.json
  link        run \`vercel link\` (writes IDs back to .env.<env>.local)
  env-up      upload env vars to Vercel ($scope = preview for staging, production for prod)
  deploy      \`vercel deploy [--prod]\`
  smoke       curl /, /login, /privacy, /manifest.json against deployed URL
  all         preflight → link → env-up → deploy
  help        this message

Examples:
  scripts/deploy.sh staging all          # full staging pipeline
  scripts/deploy.sh staging smoke        # curl tests after Vercel build settles
  scripts/deploy.sh production deploy    # prompts for confirmation
EOF
}

# ─── Dispatch ────────────────────────────────────────────────────────────────
if [[ -z "$ENV_TARGET" ]]; then cmd_help; exit 0; fi
load_vercel_target

case "$SUBCOMMAND" in
  preflight) cmd_preflight ;;
  link)      cmd_link ;;
  unprotect) cmd_unprotect ;;
  env-up)    cmd_env_up ;;
  deploy)    cmd_deploy ;;
  smoke)     cmd_smoke ;;
  all)       cmd_all ;;
  help|-h|--help) cmd_help ;;
  *) err "unknown subcommand: $SUBCOMMAND"; cmd_help; exit 1 ;;
esac
