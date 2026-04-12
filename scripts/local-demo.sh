#!/usr/bin/env bash
# ============================================================================
# PrintForge — Quick Local Demo Setup
#
# Builds all Docker images, creates a Kind cluster, and deploys all services.
# Designed for a fast demo — run this after installing Docker, kind, kubectl, helm.
#
# Usage:
#   bash scripts/local-demo.sh          # full setup
#   bash scripts/local-demo.sh --clean  # tear down everything
# ============================================================================
set -euo pipefail

CLUSTER_NAME="printforge-local"
NAMESPACE="printforge"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_step()  { echo -e "\n${BOLD}${CYAN}==> $*${NC}"; }
log_ok()    { echo -e "${GREEN}  ✓ $*${NC}"; }
log_warn()  { echo -e "${YELLOW}  ! $*${NC}"; }
log_error() { echo -e "${RED}  ✗ $*${NC}"; }

# ---------------------------------------------------------------------------
# Clean up
# ---------------------------------------------------------------------------
if [[ "${1:-}" == "--clean" ]]; then
  log_step "Cleaning up..."
  kind delete cluster --name "$CLUSTER_NAME" 2>/dev/null || true
  log_ok "Cluster deleted"
  exit 0
fi

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
log_step "Pre-flight checks"
for cmd in docker kind kubectl helm; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log_error "'$cmd' is not installed. Please install it first."
    exit 1
  fi
  log_ok "$cmd found"
done

if ! docker info >/dev/null 2>&1; then
  log_error "Docker is not running. Start Docker Desktop first."
  exit 1
fi
log_ok "Docker is running"

# ---------------------------------------------------------------------------
# Step 1: Build Docker images
# ---------------------------------------------------------------------------
log_step "Building Docker images"

SERVICES=("product-service" "order-service" "marketplace-web" "artist-service" "search-service")

for svc in "${SERVICES[@]}"; do
  echo -e "  Building ${BOLD}${svc}${NC}..."
  docker build -t "printforge/${svc}:1.0.0" "${PROJECT_DIR}/services/${svc}/" -q
  log_ok "${svc} built"
done

# ---------------------------------------------------------------------------
# Step 2: Create Kind cluster
# ---------------------------------------------------------------------------
log_step "Creating Kind cluster"

if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
  log_warn "Cluster '${CLUSTER_NAME}' already exists, reusing it"
else
  kind create cluster \
    --name "$CLUSTER_NAME" \
    --config "${PROJECT_DIR}/scripts/kind-config.yaml" \
    --wait 120s
  log_ok "Cluster created"
fi

# ---------------------------------------------------------------------------
# Step 3: Load images into Kind
# ---------------------------------------------------------------------------
log_step "Loading images into Kind cluster"

for svc in "${SERVICES[@]}"; do
  kind load docker-image "printforge/${svc}:1.0.0" --name "$CLUSTER_NAME"
  log_ok "${svc} image loaded"
done

# ---------------------------------------------------------------------------
# Step 4: Install ingress-nginx
# ---------------------------------------------------------------------------
log_step "Installing ingress-nginx"

kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml 2>/dev/null

echo "  Waiting for ingress controller..."
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s 2>/dev/null
log_ok "ingress-nginx ready"

# ---------------------------------------------------------------------------
# Step 5: Apply K8s base manifests
# ---------------------------------------------------------------------------
log_step "Applying Kubernetes manifests"

kubectl apply -f "${PROJECT_DIR}/k8s/namespaces/" 2>/dev/null
log_ok "Namespaces created"

kubectl apply -f "${PROJECT_DIR}/k8s/priority-classes/" 2>/dev/null
log_ok "Priority classes applied"

# Skip resource quotas for local (too restrictive)
# kubectl apply -f "${PROJECT_DIR}/k8s/limit-ranges/" 2>/dev/null

kubectl apply -f "${PROJECT_DIR}/k8s/rbac/" 2>/dev/null
log_ok "RBAC applied"

# Skip network policies for local (already disabled in local values)
# kubectl apply -f "${PROJECT_DIR}/k8s/network-policies/" 2>/dev/null

# ---------------------------------------------------------------------------
# Step 6: Deploy services with Helm
# ---------------------------------------------------------------------------
log_step "Deploying services with Helm"

cd "${PROJECT_DIR}"

# Build helm dependencies first
for svc in "${SERVICES[@]}"; do
  if [[ -f "helm/charts/${svc}/Chart.yaml" ]]; then
    helm dependency build "helm/charts/${svc}/" 2>/dev/null || true
  fi
done

for svc in "${SERVICES[@]}"; do
  echo -e "  Deploying ${BOLD}${svc}${NC}..."
  helm upgrade --install "$svc" "./helm/charts/${svc}/" \
    -n "$NAMESPACE" \
    -f "./helm/environments/local/values.yaml" \
    --set "image.tag=1.0.0" \
    --wait --timeout 180s 2>&1 | tail -1
  log_ok "${svc} deployed"
done

# ---------------------------------------------------------------------------
# Step 7: Wait for all pods to be ready
# ---------------------------------------------------------------------------
log_step "Waiting for pods to be ready"

kubectl wait --for=condition=ready pod \
  --all -n "$NAMESPACE" \
  --timeout=120s 2>/dev/null || log_warn "Some pods may not be ready yet"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}${GREEN}============================================${NC}"
echo -e "${BOLD}${GREEN}  PrintForge Local Demo is Ready!${NC}"
echo -e "${BOLD}${GREEN}============================================${NC}"
echo ""

kubectl get pods -n "$NAMESPACE" -o wide
echo ""
kubectl get svc -n "$NAMESPACE"

echo ""
echo -e "${BOLD}Access:${NC}"
echo "  Marketplace Web:  http://localhost (via ingress)"
echo "  product-service:  kubectl port-forward -n $NAMESPACE svc/product-service 3001:3001"
echo "  order-service:    kubectl port-forward -n $NAMESPACE svc/order-service 3003:3003"
echo "  Direct Web:       kubectl port-forward -n $NAMESPACE svc/marketplace-web 3000:3000"
echo ""
echo -e "${BOLD}Useful commands:${NC}"
echo "  kubectl get pods -n $NAMESPACE                            # pod status"
echo "  kubectl logs -n $NAMESPACE -l app.kubernetes.io/name=order-service -f  # order-service logs"
echo "  kubectl describe pod -n $NAMESPACE <pod-name>             # debug a pod"
echo "  helm list -n $NAMESPACE                                   # helm releases"
echo "  bash scripts/local-demo.sh --clean                        # tear down"
