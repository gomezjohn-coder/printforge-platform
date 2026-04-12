#!/bin/bash
set -euo pipefail

while [[ $# -gt 0 ]]; do
  case $1 in
    --service) SERVICE="$2"; shift 2 ;;
    --namespace) NAMESPACE="$2"; shift 2 ;;
    *) shift ;;
  esac
done

echo "=== Promoting canary for ${SERVICE} ==="

# Check if Flagger already promoted
PHASE=$(kubectl get canary "${SERVICE}" -n "${NAMESPACE}" -o jsonpath='{.status.phase}')

if [ "${PHASE}" = "Succeeded" ]; then
  echo "Canary already promoted by Flagger"
  exit 0
fi

if [ "${PHASE}" = "Failed" ]; then
  echo "Canary was rolled back by Flagger"
  exit 1
fi

# If still in progress, wait for Flagger to complete
echo "Waiting for Flagger to complete promotion..."
kubectl wait canary "${SERVICE}" -n "${NAMESPACE}" \
  --for=jsonpath='{.status.phase}'=Succeeded \
  --timeout=600s

echo "=== :white_check_mark: Canary promoted to production ==="
