#!/usr/bin/env bash
# ============================================================================
# PrintForge CLI — Platform engineering tool
#
# Commands:
#   printforge deploy <service> <env>     Deploy a service to an environment
#   printforge status                     Show cluster and service status
#   printforge logs <service>             Tail service logs
#   printforge canary status              Show Flagger canary status
#   printforge rollback <service>         Roll back a service deployment
#   printforge new-service <name>         Scaffold a new microservice
#
# Installation:
#   chmod +x platform/cli/printforge-cli.sh
#   ln -s "$(pwd)/platform/cli/printforge-cli.sh" /usr/local/bin/printforge
#
# ============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
NAMESPACE="${PRINTFORGE_NAMESPACE:-printforge}"
KUBE_CONTEXT="${PRINTFORGE_KUBE_CONTEXT:-}"
HELM_DIR="helm"
SERVICES_DIR="services"
TEMPLATE_DIR="platform/service-template"
REGISTRY="${PRINTFORGE_REGISTRY:-printforge}"
SLACK_WEBHOOK="${PRINTFORGE_SLACK_WEBHOOK:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
log_info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

die() { log_error "$@"; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command '$1' not found. Please install it."
}

kubectl_cmd() {
  local args=()
  if [[ -n "$KUBE_CONTEXT" ]]; then
    args+=("--context" "$KUBE_CONTEXT")
  fi
  args+=("-n" "$NAMESPACE")
  kubectl "${args[@]}" "$@"
}

confirm() {
  local prompt="${1:-Are you sure?}"
  echo -en "${YELLOW}${prompt} [y/N]: ${NC}"
  read -r answer
  [[ "$answer" =~ ^[Yy]([Ee][Ss])?$ ]]
}

notify_slack() {
  local message="$1"
  if [[ -n "$SLACK_WEBHOOK" ]]; then
    curl -s -X POST -H 'Content-type: application/json' \
      --data "{\"text\": \"$message\"}" \
      "$SLACK_WEBHOOK" >/dev/null 2>&1 || true
  fi
}

# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

# ── deploy ────────────────────────────────────────────────────────────────
cmd_deploy() {
  local service="${1:-}"
  local env="${2:-}"

  [[ -z "$service" ]] && die "Usage: printforge deploy <service> <env>"
  [[ -z "$env" ]] && die "Usage: printforge deploy <service> <env>"

  require_cmd helm
  require_cmd kubectl

  local chart_dir="${HELM_DIR}/charts/${service}"
  local values_file="${HELM_DIR}/environments/${env}/values.yaml"

  [[ -d "$chart_dir" ]] || die "Helm chart not found: $chart_dir"
  [[ -f "$values_file" ]] || die "Environment values not found: $values_file"

  echo -e "${BOLD}${CYAN}PrintForge Deploy${NC}"
  echo -e "  Service:     ${BOLD}${service}${NC}"
  echo -e "  Environment: ${BOLD}${env}${NC}"
  echo -e "  Namespace:   ${BOLD}${NAMESPACE}${NC}"
  echo ""

  # Pre-flight checks
  log_info "Running pre-flight checks..."

  # Check if namespace exists
  if ! kubectl_cmd get namespace "$NAMESPACE" >/dev/null 2>&1; then
    die "Namespace '$NAMESPACE' does not exist"
  fi

  # Check for deployment guard (no deploys without on-call SRE)
  if [[ "$env" == "production" ]]; then
    local guard_script="scripts/on-call/deployment-guard.sh"
    if [[ -f "$guard_script" ]]; then
      if ! bash "$guard_script" 2>/dev/null; then
        die "Deployment guard blocked this deploy. No SRE is currently on-call."
      fi
    fi
  fi

  # Lint the chart
  log_info "Linting Helm chart..."
  if ! helm lint "$chart_dir" -f "$values_file" --quiet; then
    die "Helm lint failed for ${service}"
  fi
  log_ok "Chart lint passed"

  # Dry run
  log_info "Running Helm dry-run..."
  helm upgrade --install "$service" "$chart_dir" \
    -n "$NAMESPACE" \
    -f "$values_file" \
    --dry-run --debug >/dev/null 2>&1
  log_ok "Dry run passed"

  # Confirm deployment
  echo ""
  if ! confirm "Deploy ${service} to ${env}?"; then
    log_warn "Deployment cancelled"
    exit 0
  fi

  # Deploy
  echo ""
  log_info "Deploying ${service} to ${env}..."
  helm upgrade --install "$service" "$chart_dir" \
    -n "$NAMESPACE" \
    -f "$values_file" \
    --wait \
    --timeout 10m \
    --atomic

  log_ok "Deployment complete: ${service} -> ${env}"

  # Wait for rollout
  log_info "Waiting for rollout to complete..."
  kubectl_cmd rollout status "deployment/${service}" --timeout=300s

  log_ok "${service} is fully rolled out in ${env}"

  # Notify Slack
  notify_slack ":rocket: *${service}* deployed to *${env}* by $(whoami)"
}

# ── status ────────────────────────────────────────────────────────────────
cmd_status() {
  require_cmd kubectl

  echo -e "${BOLD}${CYAN}PrintForge Cluster Status${NC}"
  echo -e "  Namespace: ${BOLD}${NAMESPACE}${NC}"
  echo ""

  # Deployments
  echo -e "${BOLD}Deployments:${NC}"
  kubectl_cmd get deployments -o wide 2>/dev/null || log_warn "Could not fetch deployments"
  echo ""

  # Pods
  echo -e "${BOLD}Pods:${NC}"
  kubectl_cmd get pods -o wide 2>/dev/null || log_warn "Could not fetch pods"
  echo ""

  # Services
  echo -e "${BOLD}Services:${NC}"
  kubectl_cmd get services 2>/dev/null || log_warn "Could not fetch services"
  echo ""

  # HPA
  echo -e "${BOLD}Horizontal Pod Autoscalers:${NC}"
  kubectl_cmd get hpa 2>/dev/null || log_warn "Could not fetch HPAs"
  echo ""

  # Ingress
  echo -e "${BOLD}Ingress:${NC}"
  kubectl_cmd get ingress 2>/dev/null || log_warn "Could not fetch ingress"
  echo ""

  # Resource usage
  echo -e "${BOLD}Resource Usage:${NC}"
  kubectl_cmd top pods --containers 2>/dev/null || log_warn "Metrics server not available"
  echo ""

  # Recent events (warnings only)
  echo -e "${BOLD}Recent Warning Events (last 30m):${NC}"
  kubectl_cmd get events --field-selector type=Warning --sort-by='.lastTimestamp' 2>/dev/null | tail -10 || true
}

# ── logs ──────────────────────────────────────────────────────────────────
cmd_logs() {
  local service="${1:-}"
  shift || true
  local extra_args=("$@")

  [[ -z "$service" ]] && die "Usage: printforge logs <service> [--since=1h] [--level=error] [--follow]"

  require_cmd kubectl

  local kubectl_args=()
  local follow=false
  local since=""
  local grep_pattern=""

  for arg in "${extra_args[@]}"; do
    case "$arg" in
      --follow|-f)
        follow=true
        ;;
      --since=*)
        since="${arg#--since=}"
        ;;
      --level=*)
        grep_pattern="\"level\":\"${arg#--level=}\""
        ;;
      *)
        kubectl_args+=("$arg")
        ;;
    esac
  done

  echo -e "${BOLD}${CYAN}Logs: ${service}${NC}"

  local cmd=(kubectl_cmd logs -l "app=${service}" --all-containers=true --max-log-requests=10)

  if $follow; then
    cmd+=("-f")
  fi

  if [[ -n "$since" ]]; then
    cmd+=("--since=${since}")
  else
    cmd+=("--since=15m")
  fi

  cmd+=("${kubectl_args[@]}")

  if [[ -n "$grep_pattern" ]]; then
    "${cmd[@]}" 2>/dev/null | grep --color=auto "$grep_pattern" || log_warn "No matching log entries found"
  else
    "${cmd[@]}" 2>/dev/null || log_warn "Could not fetch logs for ${service}"
  fi
}

# ── canary status ─────────────────────────────────────────────────────────
cmd_canary_status() {
  require_cmd kubectl

  echo -e "${BOLD}${CYAN}PrintForge Canary Status${NC}"
  echo ""

  # Check if Flagger CRDs exist
  if ! kubectl get crd canaries.flagger.app >/dev/null 2>&1; then
    die "Flagger CRDs not found. Is Flagger installed?"
  fi

  # List canaries
  echo -e "${BOLD}Canary Deployments:${NC}"
  kubectl_cmd get canaries -o wide 2>/dev/null || log_warn "No canaries found"
  echo ""

  # Detailed status for each canary
  local canaries
  canaries=$(kubectl_cmd get canaries -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")

  for canary in $canaries; do
    echo -e "${BOLD}--- ${canary} ---${NC}"
    local status phase weight
    status=$(kubectl_cmd get canary "$canary" -o jsonpath='{.status.conditions[0].message}' 2>/dev/null || echo "unknown")
    phase=$(kubectl_cmd get canary "$canary" -o jsonpath='{.status.phase}' 2>/dev/null || echo "unknown")
    weight=$(kubectl_cmd get canary "$canary" -o jsonpath='{.status.canaryWeight}' 2>/dev/null || echo "0")

    echo -e "  Phase:    ${phase}"
    echo -e "  Weight:   ${weight}%"
    echo -e "  Status:   ${status}"
    echo ""
  done
}

# ── rollback ──────────────────────────────────────────────────────────────
cmd_rollback() {
  local service="${1:-}"

  [[ -z "$service" ]] && die "Usage: printforge rollback <service>"

  require_cmd kubectl

  echo -e "${BOLD}${CYAN}PrintForge Rollback${NC}"
  echo -e "  Service:   ${BOLD}${service}${NC}"
  echo -e "  Namespace: ${BOLD}${NAMESPACE}${NC}"
  echo ""

  # Show rollout history
  echo -e "${BOLD}Rollout History:${NC}"
  kubectl_cmd rollout history "deployment/${service}" 2>/dev/null || die "Deployment '${service}' not found"
  echo ""

  if ! confirm "Roll back ${service} to the previous revision?"; then
    log_warn "Rollback cancelled"
    exit 0
  fi

  log_info "Rolling back ${service}..."
  kubectl_cmd rollout undo "deployment/${service}"

  log_info "Waiting for rollback to complete..."
  kubectl_cmd rollout status "deployment/${service}" --timeout=300s

  log_ok "${service} has been rolled back"

  notify_slack ":warning: *${service}* was rolled back in *${NAMESPACE}* by $(whoami)"
}

# ── new-service ───────────────────────────────────────────────────────────
cmd_new_service() {
  local name="${1:-}"

  [[ -z "$name" ]] && die "Usage: printforge new-service <name>"

  # Validate service name
  if ! [[ "$name" =~ ^[a-z][a-z0-9-]*[a-z0-9]$ ]]; then
    die "Service name must be lowercase alphanumeric with hyphens (e.g., 'order-service')"
  fi

  local service_dir="${SERVICES_DIR}/${name}"
  local chart_dir="${HELM_DIR}/charts/${name}"

  [[ -d "$service_dir" ]] && die "Service directory already exists: $service_dir"
  [[ -d "$chart_dir" ]] && die "Helm chart already exists: $chart_dir"

  echo -e "${BOLD}${CYAN}PrintForge New Service${NC}"
  echo -e "  Name:      ${BOLD}${name}${NC}"
  echo -e "  Directory: ${BOLD}${service_dir}${NC}"
  echo -e "  Chart:     ${BOLD}${chart_dir}${NC}"
  echo ""

  if ! confirm "Create new service '${name}'?"; then
    log_warn "Cancelled"
    exit 0
  fi

  # Scaffold service directory
  log_info "Creating service directory..."
  mkdir -p "${service_dir}/src"

  cat > "${service_dir}/package.json" <<EOF
{
  "name": "@printforge/${name}",
  "version": "0.1.0",
  "description": "PrintForge ${name} service",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "test": "node --test src/**/*.test.js",
    "lint": "eslint src/"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "pino": "^8.17.2",
    "pino-http": "^9.0.0",
    "prom-client": "^15.1.0"
  },
  "devDependencies": {
    "eslint": "^8.56.0"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "private": true
}
EOF

  cat > "${service_dir}/src/server.js" <<'EOF'
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const pino = require("pino");

const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health checks
app.get("/healthz", (_req, res) => res.status(200).json({ status: "ok" }));
app.get("/ready", (_req, res) => res.status(200).json({ status: "ready" }));

// TODO: Add your routes here

app.listen(PORT, () => {
  logger.info({ port: PORT }, "Service started");
});
EOF

  cat > "${service_dir}/Dockerfile" <<'EOF'
FROM node:20-alpine AS base
RUN apk add --no-cache tini
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM base AS runtime
RUN addgroup -g 1001 -S appgroup && adduser -u 1001 -S appuser -G appgroup
COPY --from=deps /app/node_modules ./node_modules
COPY . .
USER appuser
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]
EOF

  log_ok "Service directory created: ${service_dir}"

  # Scaffold Helm chart (copy from template or create minimal)
  if [[ -d "$TEMPLATE_DIR" ]]; then
    log_info "Copying Helm chart from template..."
    cp -r "$TEMPLATE_DIR" "$chart_dir" 2>/dev/null || true
  fi

  if [[ ! -d "$chart_dir" ]]; then
    log_info "Creating minimal Helm chart..."
    mkdir -p "${chart_dir}/templates"

    cat > "${chart_dir}/Chart.yaml" <<EOF
apiVersion: v2
name: ${name}
description: PrintForge ${name} Helm chart
type: application
version: 0.1.0
appVersion: "0.1.0"
EOF

    cat > "${chart_dir}/values.yaml" <<EOF
replicaCount: 2
image:
  repository: ${REGISTRY}/${name}
  tag: ""
  pullPolicy: IfNotPresent
containerPort: 3000
service:
  type: ClusterIP
  port: 3000
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "250m"
EOF
  fi

  log_ok "Helm chart created: ${chart_dir}"

  echo ""
  echo -e "${GREEN}Service '${name}' scaffolded successfully.${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. cd ${service_dir} && npm install"
  echo "  2. Add routes to src/server.js"
  echo "  3. Create environment values in helm/environments/*/values.yaml"
  echo "  4. Deploy: printforge deploy ${name} staging"
}

# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------
usage() {
  echo -e "${BOLD}${CYAN}PrintForge CLI${NC} — Platform Engineering Tool"
  echo ""
  echo "Usage:"
  echo "  printforge <command> [args]"
  echo ""
  echo "Commands:"
  echo "  deploy <service> <env>    Deploy a service to an environment"
  echo "  status                    Show cluster and service status"
  echo "  logs <service> [opts]     Tail service logs"
  echo "    --follow, -f            Follow log output"
  echo "    --since=<duration>      Show logs since (default: 15m)"
  echo "    --level=<level>         Filter by log level (error, warn, info)"
  echo "  canary status             Show Flagger canary deployment status"
  echo "  rollback <service>        Roll back to the previous deployment"
  echo "  new-service <name>        Scaffold a new microservice"
  echo ""
  echo "Environment variables:"
  echo "  PRINTFORGE_NAMESPACE      Kubernetes namespace (default: printforge)"
  echo "  PRINTFORGE_KUBE_CONTEXT   kubectl context to use"
  echo "  PRINTFORGE_REGISTRY       Container registry (default: printforge)"
  echo "  PRINTFORGE_SLACK_WEBHOOK  Slack webhook URL for notifications"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  local command="${1:-}"
  shift || true

  case "$command" in
    deploy)
      cmd_deploy "$@"
      ;;
    status)
      cmd_status "$@"
      ;;
    logs)
      cmd_logs "$@"
      ;;
    canary)
      local sub="${1:-}"
      shift || true
      case "$sub" in
        status) cmd_canary_status "$@" ;;
        *)      die "Unknown canary subcommand: $sub. Use: printforge canary status" ;;
      esac
      ;;
    rollback)
      cmd_rollback "$@"
      ;;
    new-service)
      cmd_new_service "$@"
      ;;
    help|--help|-h)
      usage
      ;;
    "")
      usage
      exit 1
      ;;
    *)
      die "Unknown command: $command. Run 'printforge help' for usage."
      ;;
  esac
}

main "$@"
