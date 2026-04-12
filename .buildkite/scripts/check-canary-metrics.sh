#!/bin/bash
set -euo pipefail

# Monitor canary health by querying Datadog API
# Fails (exit 1) if metrics breach thresholds → triggers rollback
# Usage: check-canary-metrics.sh --service order-service --duration 300

while [[ $# -gt 0 ]]; do
  case $1 in
    --service) SERVICE="$2"; shift 2 ;;
    --namespace) NAMESPACE="$2"; shift 2 ;;
    --duration) DURATION="$2"; shift 2 ;;
    --success-threshold) SUCCESS_THRESHOLD="$2"; shift 2 ;;
    --latency-threshold) LATENCY_THRESHOLD="$2"; shift 2 ;;
    *) shift ;;
  esac
done

DURATION=${DURATION:-300}
SUCCESS_THRESHOLD=${SUCCESS_THRESHOLD:-99}
LATENCY_THRESHOLD=${LATENCY_THRESHOLD:-500}
CHECK_INTERVAL=30
CHECKS=$((DURATION / CHECK_INTERVAL))
FAILED_CHECKS=0
MAX_FAILURES=3

echo "=== Monitoring canary metrics for ${DURATION}s ==="
echo "Success rate threshold: ${SUCCESS_THRESHOLD}%"
echo "Latency threshold: ${LATENCY_THRESHOLD}ms"
echo "Max consecutive failures: ${MAX_FAILURES}"

for i in $(seq 1 $CHECKS); do
  echo "--- Check ${i}/${CHECKS}"

  # Query Datadog for canary success rate
  SUCCESS_RATE=$(curl -s \
    -H "DD-API-KEY: ${DD_API_KEY}" \
    -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
    "${DATADOG_API_URL}/api/v1/query?from=$(date -d '-1 min' +%s)&to=$(date +%s)&query=avg:http_requests_total{service:${SERVICE}-canary,!status_code:5*}.as_count()/avg:http_requests_total{service:${SERVICE}-canary}.as_count()*100" \
    | jq -r '.series[0].pointlist[-1][1] // 100')

  # Query Datadog for canary P99 latency
  P99_LATENCY=$(curl -s \
    -H "DD-API-KEY: ${DD_API_KEY}" \
    -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
    "${DATADOG_API_URL}/api/v1/query?from=$(date -d '-1 min' +%s)&to=$(date +%s)&query=p99:http_request_duration_seconds{service:${SERVICE}-canary}*1000" \
    | jq -r '.series[0].pointlist[-1][1] // 0')

  echo "  Success rate: ${SUCCESS_RATE}% (threshold: ${SUCCESS_THRESHOLD}%)"
  echo "  P99 latency:  ${P99_LATENCY}ms (threshold: ${LATENCY_THRESHOLD}ms)"

  # Check thresholds
  PASS=true
  if (( $(echo "$SUCCESS_RATE < $SUCCESS_THRESHOLD" | bc -l) )); then
    echo "  :warning: Success rate below threshold!"
    PASS=false
  fi
  if (( $(echo "$P99_LATENCY > $LATENCY_THRESHOLD" | bc -l) )); then
    echo "  :warning: Latency above threshold!"
    PASS=false
  fi

  if [ "$PASS" = false ]; then
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    echo "  Failed checks: ${FAILED_CHECKS}/${MAX_FAILURES}"

    if [ $FAILED_CHECKS -ge $MAX_FAILURES ]; then
      echo "=== :rotating_light: CANARY FAILED — ${MAX_FAILURES} consecutive failures ==="
      exit 1
    fi
  else
    FAILED_CHECKS=0  # Reset on success
    echo "  :white_check_mark: Metrics healthy"
  fi

  # Check Flagger canary status
  CANARY_STATUS=$(kubectl get canary "${SERVICE}" -n "${NAMESPACE}" -o jsonpath='{.status.phase}' 2>/dev/null || echo "unknown")
  echo "  Flagger status: ${CANARY_STATUS}"

  if [ "${CANARY_STATUS}" = "Failed" ]; then
    echo "=== :rotating_light: Flagger detected failure — canary rolled back ==="
    exit 1
  fi

  if [ "${CANARY_STATUS}" = "Succeeded" ]; then
    echo "=== :white_check_mark: Flagger promoted canary ==="
    exit 0
  fi

  sleep $CHECK_INTERVAL
done

echo "=== :white_check_mark: All metrics checks passed ==="
exit 0
