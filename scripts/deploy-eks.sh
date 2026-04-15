#!/bin/bash
# =============================================================================
# RawCanvas — Deploy to EKS
# =============================================================================
# Prerequisites: EKS cluster running, kubectl configured, ECR images pushed
# Usage: bash scripts/deploy-eks.sh
# =============================================================================
set -euo pipefail

REGISTRY="646294700619.dkr.ecr.ap-southeast-2.amazonaws.com"
NAMESPACE="printforge"
TAG="v1"

echo "=== Step 1: Configure kubectl ==="
aws eks update-kubeconfig --name printforge-staging --region ap-southeast-2
kubectl get nodes

echo ""
echo "=== Step 2: Create namespace ==="
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

echo ""
echo "=== Step 3: Deploy Postgres + Redis ==="
kubectl apply -f k8s/infra/postgres.yaml
kubectl apply -f k8s/infra/redis.yaml
echo "Waiting for postgres..."
kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=120s
echo "Waiting for redis..."
kubectl wait --for=condition=ready pod -l app=redis -n $NAMESPACE --timeout=120s

echo ""
echo "=== Step 4: Install NGINX Ingress Controller ==="
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx 2>/dev/null || true
helm repo update
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  -n ingress-nginx --create-namespace \
  --set controller.service.type=LoadBalancer \
  --wait --timeout 300s

echo ""
echo "=== Step 5: Build Helm dependencies ==="
for chart in product-service order-service marketplace-web artist-service search-service; do
  helm dependency build helm/charts/$chart 2>/dev/null || true
done

echo ""
echo "=== Step 6: Deploy all services via Helm ==="
SERVICES="product-service order-service marketplace-web artist-service search-service"
for svc in $SERVICES; do
  echo "Deploying $svc..."
  helm upgrade --install $svc ./helm/charts/$svc \
    -n $NAMESPACE \
    -f ./helm/environments/staging/values.yaml \
    --set image.repository=${REGISTRY}/rawcanvas/${svc} \
    --set image.tag=${TAG} \
    --set image.pullPolicy=Always \
    --wait --timeout 300s
done

echo ""
echo "=== Step 7: Seed database ==="
PRODUCT_POD=$(kubectl get pod -n $NAMESPACE -l app.kubernetes.io/name=product-service -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n $NAMESPACE $PRODUCT_POD -- node src/seed.js || echo "Seed may have already run"

echo ""
echo "=== Step 8: Get access URL ==="
echo "Pods:"
kubectl get pods -n $NAMESPACE
echo ""
echo "Services:"
kubectl get svc -n $NAMESPACE
echo ""
echo "Ingress LB:"
kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
echo ""
echo ""
echo "=== DEPLOYMENT COMPLETE ==="
