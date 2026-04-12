#!/usr/bin/env bash
# ============================================================================
# PrintForge — Kind Cluster Setup
#
# Creates a local Kubernetes development cluster using Kind (Kubernetes IN Docker)
# with ingress-nginx and Flagger pre-configured. Applies all K8s manifests from
# the k8s/ directory.
#
# Prerequisites:
#   - Docker running
#   - kind installed (https://kind.sigs.k8s.io/)
#   - kubectl installed
#   - helm installed
#
# Usage:
#   bash scripts/setup-kind-cluster.sh
#   bash scripts/setup-kind-cluster.sh --name my-cluster
#   bash scripts/setup-kind-cluster.sh --delete
#
# ============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
CLUSTER_NAME="${1:-printforge-dev}"
KIND_CONFIG="scripts/kind-config.yaml"
NAMESPACE="printforge"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
die()       { log_error "$@"; exit 1; }

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
preflight() {
  log_info "Running pre-flight checks..."

  for cmd in docker kind kubectl helm; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      die "'$cmd' is required but not installed."
    fi
  done

  if ! docker info >/dev/null 2>&1; then
    die "Docker is not running. Please start Docker first."
  fi

  log_ok "All prerequisites satisfied"
}

# ---------------------------------------------------------------------------
# Handle --delete flag
# ---------------------------------------------------------------------------
if [[ "${1:-}" == "--delete" ]]; then
  CLUSTER_NAME="${2:-printforge-dev}"
  log_info "Deleting Kind cluster: ${CLUSTER_NAME}"
  kind delete cluster --name "$CLUSTER_NAME" 2>/dev/null || true
  log_ok "Cluster deleted"
  exit 0
fi

# ---------------------------------------------------------------------------
# Create cluster
# ---------------------------------------------------------------------------
create_cluster() {
  echo -e "${BOLD}${CYAN}Creating Kind cluster: ${CLUSTER_NAME}${NC}"

  # Check if cluster already exists
  if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
    log_warn "Cluster '${CLUSTER_NAME}' already exists"
    if [[ "${FORCE:-}" == "true" ]]; then
      log_info "Deleting existing cluster..."
      kind delete cluster --name "$CLUSTER_NAME"
    else
      log_info "Use --delete to remove it first, or set FORCE=true"
      return 0
    fi
  fi

  # Create the cluster with config
  if [[ -f "${PROJECT_DIR}/${KIND_CONFIG}" ]]; then
    log_info "Using Kind config: ${KIND_CONFIG}"
    kind create cluster \
      --name "$CLUSTER_NAME" \
      --config "${PROJECT_DIR}/${KIND_CONFIG}" \
      --wait 120s
  else
    log_warn "Kind config not found at ${KIND_CONFIG}, using defaults"
    kind create cluster \
      --name "$CLUSTER_NAME" \
      --wait 120s
  fi

  log_ok "Kind cluster created: ${CLUSTER_NAME}"

  # Set kubectl context
  kubectl cluster-info --context "kind-${CLUSTER_NAME}"
}

# ---------------------------------------------------------------------------
# Install ingress-nginx
# ---------------------------------------------------------------------------
install_ingress() {
  log_info "Installing ingress-nginx..."

  helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx 2>/dev/null || true
  helm repo update ingress-nginx

  kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

  log_info "Waiting for ingress-nginx to be ready..."
  kubectl wait --namespace ingress-nginx \
    --for=condition=ready pod \
    --selector=app.kubernetes.io/component=controller \
    --timeout=120s

  log_ok "ingress-nginx installed and ready"
}

# ---------------------------------------------------------------------------
# Install Flagger
# ---------------------------------------------------------------------------
install_flagger() {
  log_info "Installing Flagger..."

  helm repo add flagger https://flagger.app 2>/dev/null || true
  helm repo update flagger

  # Install Flagger with nginx ingress provider
  kubectl create namespace flagger-system 2>/dev/null || true

  helm upgrade --install flagger flagger/flagger \
    --namespace flagger-system \
    --set meshProvider=nginx \
    --set prometheus.install=true \
    --wait

  # Install Flagger load tester
  helm upgrade --install flagger-loadtester flagger/loadtester \
    --namespace flagger-system \
    --wait

  log_ok "Flagger installed"
}

# ---------------------------------------------------------------------------
# Apply K8s manifests
# ---------------------------------------------------------------------------
apply_manifests() {
  log_info "Applying Kubernetes manifests..."

  cd "$PROJECT_DIR"

  # Create namespace first
  if [[ -f "k8s/namespaces/printforge.yaml" ]]; then
    kubectl apply -f k8s/namespaces/printforge.yaml
    log_ok "Namespace created"
  else
    kubectl create namespace "$NAMESPACE" 2>/dev/null || true
  fi

  # Apply in dependency order
  local manifest_dirs=(
    "k8s/priority-classes"
    "k8s/limit-ranges"
    "k8s/resource-quotas"
    "k8s/rbac"
    "k8s/network-policies"
  )

  for dir in "${manifest_dirs[@]}"; do
    if [[ -d "$dir" ]]; then
      log_info "Applying ${dir}..."
      kubectl apply -f "$dir/" --recursive 2>/dev/null || log_warn "Some resources in ${dir} may have failed"
    fi
  done

  log_ok "All K8s manifests applied"
}

# ---------------------------------------------------------------------------
# Install local development Helm charts
# ---------------------------------------------------------------------------
install_services() {
  log_info "Installing services with local values..."

  cd "$PROJECT_DIR"

  local local_values="helm/environments/local/values.yaml"

  if [[ ! -f "$local_values" ]]; then
    log_warn "Local values not found: ${local_values}. Skipping Helm installs."
    return 0
  fi

  local charts_dir="helm/charts"
  for chart in "${charts_dir}"/*/; do
    local chart_name
    chart_name=$(basename "$chart")

    log_info "Installing ${chart_name}..."
    helm upgrade --install "$chart_name" "$chart" \
      -n "$NAMESPACE" \
      -f "$local_values" \
      --wait --timeout 5m 2>/dev/null || log_warn "Failed to install ${chart_name} (may need images built first)"
  done

  log_ok "Service Helm charts processed"
}

# ---------------------------------------------------------------------------
# Print summary
# ---------------------------------------------------------------------------
print_summary() {
  echo ""
  echo -e "${BOLD}${GREEN}Kind cluster is ready.${NC}"
  echo ""
  echo "Cluster:    ${CLUSTER_NAME}"
  echo "Context:    kind-${CLUSTER_NAME}"
  echo "Namespace:  ${NAMESPACE}"
  echo "Ingress:    http://localhost:80"
  echo ""
  echo "Useful commands:"
  echo "  kubectl get pods -n ${NAMESPACE}        # list pods"
  echo "  kubectl get svc -n ${NAMESPACE}         # list services"
  echo "  kubectl logs -n ${NAMESPACE} -l app=order-service -f  # tail order-service logs"
  echo "  kind delete cluster --name ${CLUSTER_NAME}              # delete cluster"
  echo ""
  echo "To build and load images into Kind:"
  echo "  docker build -t printforge/order-service:dev services/order-service/"
  echo "  kind load docker-image printforge/order-service:dev --name ${CLUSTER_NAME}"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  echo -e "${BOLD}${CYAN}PrintForge Kind Cluster Setup${NC}"
  echo ""

  preflight
  create_cluster
  install_ingress
  install_flagger
  apply_manifests
  install_services
  print_summary
}

main
