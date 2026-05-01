#!/usr/bin/env bash
# ============================================================================
# test-rls.sh — RLS penetration test
# Stack contract: NFR-009 — 100% RLS coverage; 0 cross-tenant rows returned
#                 auth.multi_tenant.rls=required
#
# Usage:
#   ./scripts/test-rls.sh
#
# Requires: psql, jq, DIRECT_DATABASE_URL env var
# Runs 50 cross-tenant query attempts and asserts 0 rows are leaked.
# Exits non-zero if any cross-tenant data is accessible.
# ============================================================================

set -euo pipefail

if [[ -z "${DIRECT_DATABASE_URL:-}" ]]; then
  echo "ERROR: DIRECT_DATABASE_URL is not set"
  exit 1
fi

PSQL="psql ${DIRECT_DATABASE_URL} -t -c"
PASS=0
FAIL=0
ERRORS=()

# ---------------------------------------------------------------------------
# Helper: run a cross-tenant query as a fake JWT claiming crew_id = CREW_A
# but querying data owned by CREW_B. Asserts row count = 0.
# ---------------------------------------------------------------------------
run_cross_tenant_test() {
  local test_name="$1"
  local crew_a_id="$2"  # attacker's crew_id
  local crew_b_id="$3"  # victim's crew_id
  local table="$4"
  local column="$5"
  local value="$6"

  # Simulate the attacker's JWT by setting request.jwt.claims
  local query="
    BEGIN;
    SELECT set_config('request.jwt.claims',
      jsonb_build_object('crew_id', '${crew_a_id}')::text,
      true);
    SET ROLE authenticated;
    SELECT count(*) FROM public.${table} WHERE ${column} = '${value}';
    ROLLBACK;
  "

  local result
  result=$($PSQL "$query" 2>&1 | grep -E '^[[:space:]]*[0-9]+' | tr -d ' ' | tail -1)

  if [[ "${result}" == "0" ]]; then
    PASS=$((PASS + 1))
    echo "  PASS: ${test_name}"
  else
    FAIL=$((FAIL + 1))
    ERRORS+=("FAIL: ${test_name} — returned ${result} rows (expected 0)")
    echo "  FAIL: ${test_name} — returned ${result} rows (CROSS-TENANT LEAK!)"
  fi
}

echo "============================================================"
echo "QuotingAgent RLS Penetration Test"
echo "$(date -u)"
echo "============================================================"
echo ""

# ---------------------------------------------------------------------------
# Step 1: Create two test crews directly (bypassing RLS via superuser)
# ---------------------------------------------------------------------------
echo "[1/3] Creating test tenants..."

CREW_A_ID=$(psql "${DIRECT_DATABASE_URL}" -t -c "
  INSERT INTO public.crews (business_name, trade_type, nsw_licence_number, default_labour_rate_aud)
  VALUES ('Test Crew A', 'roofer', 'TEST-A-001', 85.00)
  RETURNING id;
" | tr -d ' \n')

CREW_B_ID=$(psql "${DIRECT_DATABASE_URL}" -t -c "
  INSERT INTO public.crews (business_name, trade_type, nsw_licence_number, default_labour_rate_aud)
  VALUES ('Test Crew B', 'painter', 'TEST-B-001', 75.00)
  RETURNING id;
" | tr -d ' \n')

if [[ -z "${CREW_A_ID}" || -z "${CREW_B_ID}" ]]; then
  echo "ERROR: Failed to create test crews"
  exit 1
fi

echo "  Crew A: ${CREW_A_ID}"
echo "  Crew B: ${CREW_B_ID}"

# Insert a lead for Crew B that Crew A should NOT be able to see
CREW_B_LEAD_ID=$(psql "${DIRECT_DATABASE_URL}" -t -c "
  INSERT INTO public.leads (crew_id, source, customer_name, status)
  VALUES ('${CREW_B_ID}', 'manual', 'Bob Victim', 'new')
  RETURNING id;
" | tr -d ' \n')

echo ""

# ---------------------------------------------------------------------------
# Step 2: Run 50 cross-tenant query attempts
# ---------------------------------------------------------------------------
echo "[2/3] Running 50 cross-tenant access attempts..."
echo ""

# Test 1-10: Direct crew table access
for i in $(seq 1 10); do
  run_cross_tenant_test \
    "crews: Crew A cannot read Crew B profile (#${i})" \
    "${CREW_A_ID}" "${CREW_B_ID}" \
    "crews" "id" "${CREW_B_ID}"
done

# Test 11-20: Leads access
for i in $(seq 11 20); do
  run_cross_tenant_test \
    "leads: Crew A cannot read Crew B leads (#${i})" \
    "${CREW_A_ID}" "${CREW_B_ID}" \
    "leads" "crew_id" "${CREW_B_ID}"
done

# Test 21-30: Photos (indirect via lead)
for i in $(seq 21 30); do
  run_cross_tenant_test \
    "photos: Crew A cannot read Crew B photos (#${i})" \
    "${CREW_A_ID}" "${CREW_B_ID}" \
    "photos" "lead_id" "${CREW_B_LEAD_ID}"
done

# Test 31-40: Quotes
for i in $(seq 31 40); do
  run_cross_tenant_test \
    "quotes: Crew A cannot read Crew B quotes (#${i})" \
    "${CREW_A_ID}" "${CREW_B_ID}" \
    "quotes" "crew_id" "${CREW_B_ID}"
done

# Test 41-50: FSM connections
for i in $(seq 41 50); do
  run_cross_tenant_test \
    "fsm_connections: Crew A cannot read Crew B FSM tokens (#${i})" \
    "${CREW_A_ID}" "${CREW_B_ID}" \
    "fsm_connections" "crew_id" "${CREW_B_ID}"
done

echo ""

# ---------------------------------------------------------------------------
# Step 3: Cleanup test data
# ---------------------------------------------------------------------------
echo "[3/3] Cleaning up test data..."
psql "${DIRECT_DATABASE_URL}" -c "
  DELETE FROM public.crews WHERE id IN ('${CREW_A_ID}', '${CREW_B_ID}');
" > /dev/null 2>&1

echo ""
echo "============================================================"
echo "Results: ${PASS} passed, ${FAIL} failed"
echo "============================================================"

if [[ ${#ERRORS[@]} -gt 0 ]]; then
  echo ""
  echo "FAILURES:"
  for err in "${ERRORS[@]}"; do
    echo "  ${err}"
  done
fi

if [[ ${FAIL} -gt 0 ]]; then
  echo ""
  echo "CRITICAL: Cross-tenant data leak detected! Fix RLS policies before beta."
  exit 1
else
  echo ""
  echo "All RLS tests passed. No cross-tenant data leaks detected."
  exit 0
fi
