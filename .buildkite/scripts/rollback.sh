#!/bin/bash
set -euo pipefail

while [[ $# -gt 0 ]]; do
  case $1 in
    --service) SERVICE="$2"; shift 2 ;;
    --namespace) NAMESPACE="$2"; shift 2 ;;
    --revision) REVISION="$2"; shift 2 ;;
    *) shift ;;
  esac
done

echo "=== :rotating_light: ROLLBACK: ${SERVICE} in ${NAMESPACE} ==="

if [ -n "${REVISION:-}" ]; then
  echo "Rolling back to revision: ${REVISION}"
  helm rollback "${SERVICE}" "${REVISION}" -n "${NAMESPACE}" --wait --timeout 120s
else
  echo "Rolling back to previous revision"
  helm rollback "${SERVICE}" -n "${NAMESPACE}" --wait --timeout 120s
fi

# Verify rollback
echo "--- Verifying rollback..."
kubectl rollout status deployment "${SERVICE}" -n "${NAMESPACE}" --timeout=120s

echo "=== Rollback complete ==="
