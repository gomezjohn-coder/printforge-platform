# Adding a New Microservice

**Last Updated**: 2024-03-15
**Owner**: Platform Engineering Team
**Related ADR**: ADR-004 (Helm Library Chart)

## Overview

This guide walks you through adding a new microservice to the PrintForge platform. The shared Helm library chart (ADR-004) handles most of the Kubernetes boilerplate -- you provide a service-specific `values.yaml` and the library generates the Deployment, Service, Ingress, HPA, NetworkPolicy, Canary, and ServiceMonitor resources.

**Estimated time**: 2-3 hours for a new service from scaffold to staging deployment.

## Prerequisites

- Completed the [local setup guide](local-setup.md)
- Familiarity with Docker, Helm, and Kubernetes basics
- Access to the `printforge` GitHub organization
- Access to AWS (ECR, EKS) via SSO

## Step 1: Create the Service Repository

### From the Template

```bash
# Use the GitHub template repository
# Navigate to: https://github.com/printforge/service-template
# Click "Use this template" -> "Create a new repository"
# Name: printforge/<service-name>

# Clone the new repository
git clone git@github.com:printforge/<service-name>.git
cd <service-name>
```

### Template Structure

The template provides:

```
<service-name>/
  .github/
    workflows/
      ci.yml              # GitHub Actions CI pipeline (pre-configured)
  .buildkite/
    pipeline.yml           # Buildkite CD pipeline (pre-configured)
  cmd/
    server/
      main.go              # Application entry point (or your language equivalent)
  internal/                # Application code
  Dockerfile               # Multi-stage build
  Makefile                 # Standard targets: lint, test, build, docker-build
  go.mod                   # Dependencies (or package.json, Gemfile, etc.)
```

### Customize the Template

1. Update the service name in `Makefile`, `Dockerfile`, and CI/CD pipelines
2. Implement your service logic in `internal/` (or equivalent)
3. Add a health check endpoint at `GET /health` that returns 200 when the service is ready
4. Add a metrics endpoint at `GET /metrics` in Prometheus exposition format

## Step 2: Create the ECR Repository

```bash
# Create the ECR repository
aws ecr create-repository \
  --repository-name <service-name> \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256 \
  --region us-west-2

# Or via Terraform (preferred):
cd ~/workspace/printforge/infrastructure/terraform/ecr
# Add your repository to the terraform configuration and apply
```

## Step 3: Create the Helm Chart

### Chart Structure

```bash
cd ~/workspace/printforge/platform-charts/charts
mkdir <service-name>
```

Create the following files:

### `Chart.yaml`

```yaml
apiVersion: v2
name: <service-name>
description: <Brief description of the service>
type: application
version: 0.1.0
appVersion: "1.0.0"
dependencies:
  - name: printforge-library
    version: "1.x.x"
    repository: "file://../printforge-library"
```

### `values.yaml`

This is the primary file you customize. The library chart provides sensible defaults for everything not specified here.

```yaml
# Service identity
nameOverride: <service-name>
fullnameOverride: <service-name>

# Container image
image:
  repository: <account-id>.dkr.ecr.us-west-2.amazonaws.com/<service-name>
  tag: "latest"  # Overridden by CI/CD with commit SHA
  pullPolicy: IfNotPresent

# Replica configuration
replicaCount: 2

# Resource requests and limits
resources:
  requests:
    cpu: 100m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi

# Health checks (library provides defaults; override if needed)
readinessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 10

livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 15
  periodSeconds: 20

# Ingress configuration
ingress:
  enabled: true
  host: <service-name>.printforge.io
  path: /
  annotations:
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"

# Horizontal Pod Autoscaler
hpa:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

# Canary deployment (Flagger)
canary:
  enabled: true
  analysis:
    interval: 30s
    threshold: 5
    maxWeight: 50
    stepWeight: 10
    metrics:
      - name: request-success-rate
        thresholdRange:
          min: 99
        interval: 30s
      - name: request-duration
        thresholdRange:
          max: 500
        interval: 30s

# Network policies
networkPolicy:
  enabled: true
  ingress:
    - from:
        namespaceSelector:
          matchLabels:
            name: ingress-nginx
      ports:
        - port: 8080
    # Add additional ingress rules for services that call this service
  egress:
    - to:
        namespaceSelector: {}
        podSelector:
          matchLabels:
            k8s-app: kube-dns
      ports:
        - port: 53
          protocol: UDP
    # Add egress rules for databases, AWS endpoints, etc.

# Environment variables
env:
  LOG_LEVEL: "info"
  PORT: "8080"

# Environment variables from secrets
envFromSecret:
  DATABASE_URL:
    secretName: <service-name>-db
    key: url

# Service monitor for Prometheus
serviceMonitor:
  enabled: true
  interval: 15s
  path: /metrics
```

### `values-local.yaml` (for Kind cluster development)

```yaml
image:
  repository: printforge/<service-name>
  tag: local
  pullPolicy: Never  # Image is pre-loaded into Kind

replicaCount: 1

ingress:
  enabled: true
  host: <service-name>.localhost

canary:
  enabled: false  # Disable canary in local development

hpa:
  enabled: false  # Disable HPA in local development

resources:
  requests:
    cpu: 50m
    memory: 128Mi
  limits:
    cpu: 200m
    memory: 256Mi
```

### `values-staging.yaml`

```yaml
replicaCount: 2

ingress:
  host: <service-name>.staging.printforge.io

canary:
  enabled: true

hpa:
  minReplicas: 2
  maxReplicas: 5

resources:
  requests:
    cpu: 100m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi
```

### `values-production.yaml`

```yaml
replicaCount: 3

ingress:
  host: <service-name>.printforge.io

canary:
  enabled: true

hpa:
  minReplicas: 3
  maxReplicas: 15

resources:
  requests:
    cpu: 250m
    memory: 512Mi
  limits:
    cpu: 1000m
    memory: 1Gi
```

### Build Dependencies

```bash
cd ~/workspace/printforge/platform-charts/charts/<service-name>
helm dependency build
```

## Step 4: Create Kubernetes Secrets

```bash
# Create secrets in AWS Secrets Manager (production/staging)
aws secretsmanager create-secret \
  --name printforge/<service-name>/database-url \
  --secret-string "postgresql://user:pass@host:5432/dbname" \
  --region us-west-2

# For local development, create Kubernetes secrets directly
kubectl -n marketplace create secret generic <service-name>-db \
  --from-literal=url="postgresql://printforge:localpass@postgres:5432/<service-name>"
```

## Step 5: Configure CI/CD

### GitHub Actions (CI)

The template provides a working CI pipeline. Update the service name and ECR repository in `.github/workflows/ci.yml`:

```yaml
env:
  SERVICE_NAME: <service-name>
  ECR_REPOSITORY: <account-id>.dkr.ecr.us-west-2.amazonaws.com/<service-name>
```

### Buildkite (CD)

Update `.buildkite/pipeline.yml` with the service name and chart path:

```yaml
env:
  SERVICE_NAME: <service-name>
  CHART_PATH: charts/<service-name>
```

### Configure Buildkite Pipeline

1. Navigate to Buildkite: `https://buildkite.com/printforge`
2. Create a new pipeline for `<service-name>`
3. Connect it to the GitHub repository
4. Set up the webhook trigger from GitHub Actions

## Step 6: Configure DNS and Ingress

### Cloudflare DNS

Add DNS records for the new service:

```bash
# Via Terraform (preferred)
cd ~/workspace/printforge/infrastructure/terraform/cloudflare
# Add the DNS record and apply

# Or via Cloudflare dashboard:
# Type: CNAME
# Name: <service-name> (or <service-name>.staging)
# Target: printforge-eks-alb.us-west-2.elb.amazonaws.com
# Proxy: Enabled (orange cloud)
```

## Step 7: Define SLOs

Add SLO definitions for the new service. Update the Prometheus recording rules:

```yaml
# In monitoring/prometheus-rules/slo-<service-name>.yaml
groups:
  - name: slo.<service-name>
    rules:
      - record: slo:error_budget_remaining:ratio
        expr: |
          1 - (
            sum(rate(http_requests_total{status=~"5..",service="<service-name>"}[30d]))
            /
            sum(rate(http_requests_total{service="<service-name>"}[30d]))
          ) / (1 - 0.995)
        labels:
          service: <service-name>
          slo: availability
```

Add the service to the SLO Grafana dashboard and the error budget policy (see `docs/sla/error-budget-policy.md`).

## Step 8: Deploy to Staging

```bash
# Build and push image
cd ~/workspace/printforge/<service-name>
make docker-build TAG=$(git rev-parse --short HEAD)
make docker-push TAG=$(git rev-parse --short HEAD)

# Deploy to staging via Helm
cd ~/workspace/printforge/platform-charts
helm upgrade --install <service-name> charts/<service-name> \
  -n marketplace \
  -f charts/<service-name>/values-staging.yaml \
  --set image.tag=$(git -C ~/workspace/printforge/<service-name> rev-parse --short HEAD) \
  --kube-context staging

# Verify deployment
kubectl -n marketplace get pods -l app=<service-name> --context staging
kubectl -n marketplace get canary <service-name> --context staging
```

## Step 9: Deploy to Production

Once staging is validated:

1. Merge your PR to `main` in the service repository
2. GitHub Actions CI runs lint, test, build, push
3. CI triggers Buildkite CD pipeline
4. Buildkite deploys to staging automatically
5. After smoke tests pass, approve the production deployment gate in Buildkite
6. Flagger manages the canary rollout in production

## Checklist: New Service Readiness

Before deploying to production, ensure:

- [ ] Health check endpoint (`/health`) returns 200 when ready, 503 when not
- [ ] Metrics endpoint (`/metrics`) exposes Prometheus metrics
- [ ] Graceful shutdown handles SIGTERM (drain in-flight requests)
- [ ] Dockerfile uses multi-stage build with non-root user
- [ ] Helm chart values defined for local, staging, and production
- [ ] Network policies define explicit ingress and egress rules
- [ ] Canary analysis metrics are configured and tested
- [ ] SLO and error budget recording rules are defined
- [ ] Grafana dashboard created for the service
- [ ] CI pipeline passes (lint, test, security scan, build)
- [ ] CD pipeline configured in Buildkite
- [ ] DNS records created in Cloudflare
- [ ] ECR repository created with scan-on-push
- [ ] Secrets stored in AWS Secrets Manager
- [ ] Service documented in architecture overview
- [ ] On-call team briefed on the new service

## Reference: What the Library Chart Provides

The `printforge-library` chart generates these resources from your `values.yaml`:

| Resource | Template | Customizable Via |
|---|---|---|
| Deployment | `_deployment.tpl` | `replicaCount`, `resources`, `env`, probes |
| Service | `_service.tpl` | `service.port`, `service.type` |
| Ingress | `_ingress.tpl` | `ingress.host`, `ingress.path`, annotations |
| HPA | `_hpa.tpl` | `hpa.minReplicas`, `hpa.maxReplicas`, targets |
| Canary | `_canary.tpl` | `canary.analysis.*` |
| NetworkPolicy | `_netpol.tpl` | `networkPolicy.ingress`, `networkPolicy.egress` |
| ServiceMonitor | `_servicemonitor.tpl` | `serviceMonitor.interval`, `serviceMonitor.path` |
| PodDisruptionBudget | `_pdb.tpl` | `pdb.minAvailable` (default: 1) |

You should not need to create custom templates. If the library chart does not support your use case, discuss with the platform team -- it may warrant a library chart enhancement rather than a custom template.
