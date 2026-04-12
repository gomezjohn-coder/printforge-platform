#!/bin/bash
set -euo pipefail

ENV=${1:-production}

case $ENV in
  production) BASE_URL="https://api.printforge.com" ;;
  staging)    BASE_URL="https://api-staging.printforge.com" ;;
  local)      BASE_URL="http://localhost:3001" ;;
esac

echo "=== Smoke Tests: ${ENV} (${BASE_URL}) ==="
PASS=0
FAIL=0

check() {
  local name=$1
  local url=$2
  local expected_status=${3:-200}

  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${url}" || echo "000")
  if [ "${STATUS}" = "${expected_status}" ]; then
    echo "  :white_check_mark: ${name} (${STATUS})"
    PASS=$((PASS + 1))
  else
    echo "  :x: ${name} (expected ${expected_status}, got ${STATUS})"
    FAIL=$((FAIL + 1))
  fi
}

check "Health Check"     "${BASE_URL}/healthz"
check "Readiness Check"  "${BASE_URL}/readyz"
check "List Products"    "${BASE_URL}/api/v1/products"
check "List Categories"  "${BASE_URL}/api/v1/categories"
check "List Artists"     "${BASE_URL}/api/v1/artists"
check "Metrics Endpoint" "${BASE_URL}/metrics"

echo ""
echo "=== Results: ${PASS} passed, ${FAIL} failed ==="

[ $FAIL -eq 0 ] && exit 0 || exit 1
