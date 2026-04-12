#!/bin/bash
set -euo pipefail

# Deploy canary via Helm — Flagger handles traffic shifting
# Usage: deploy-canary.sh --service order-service --image-tag abc123 --namespace printforge

while [[ $# -gt 0 ]]; do
  case $1 in
    --service) SERVICE="$2"; shift 2 ;;
    --image-tag) IMAGE_TAG="$2"; shift 2 ;;
    --namespace) NAMESPACE="$2"; shift 2 ;;
    --strategy) STRATEGY="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
IMAGE_URI="${ECR_REGISTRY}/printforge/${SERVICE}:${IMAGE_TAG}"

echo "=== Deploying ${SERVICE}:${IMAGE_TAG} to ${NAMESPACE} ==="
echo "Strategy: ${STRATEGY:-canary}"

# Update kubeconfig
aws eks update-kubeconfig --name "${CLUSTER_NAME}" --region "${AWS_REGION}"

# Helm upgrade — Flagger detects the image change and initiates canary
helm upgrade --install "${SERVICE}" "./helm/charts/${SERVICE}" \
  --namespace "${NAMESPACE}" \
  --values "./helm/environments/production/values.yaml" \
  --set image.repository="${ECR_REGISTRY}/printforge/${SERVICE}" \
  --set image.tag="${IMAGE_TAG}" \
  --set canary.enabled=$( [ "${STRATEGY}" = "canary" ] && echo "true" || echo "false" ) \
  --wait \
  --timeout 300s \
  --atomic

echo "=== Deployment initiated. Flagger will manage traffic shifting. ==="

# Wait for Flagger to detect the canary
sleep 10
kubectl get canary "${SERVICE}" -n "${NAMESPACE}" -o wide || true
