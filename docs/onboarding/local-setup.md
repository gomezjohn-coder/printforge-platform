# Developer Onboarding: Local Setup

**Last Updated**: 2024-03-15
**Owner**: Platform Engineering Team
**Time to Complete**: 45-60 minutes

## Overview

This guide walks you through setting up a local development environment for PrintForge microservices. You will have a fully functional local cluster with all four services running by the end.

## Prerequisites

Install the following tools before proceeding. Version numbers indicate the minimum required version.

### Required Tools

| Tool | Version | Purpose | Install |
|---|---|---|---|
| Docker Desktop | 4.25+ | Container runtime | [docker.com/products/docker-desktop](https://docker.com/products/docker-desktop) |
| kubectl | 1.29+ | Kubernetes CLI | `brew install kubectl` or [kubernetes.io/docs/tasks/tools](https://kubernetes.io/docs/tasks/tools/) |
| Helm | 3.14+ | Kubernetes package manager | `brew install helm` |
| Kind | 0.22+ | Local Kubernetes cluster | `brew install kind` |
| AWS CLI | 2.15+ | AWS access for ECR, secrets | `brew install awscli` |
| jq | 1.7+ | JSON processing | `brew install jq` |
| Make | 4.0+ | Build automation | Pre-installed on macOS/Linux |

### Optional Tools

| Tool | Purpose | Install |
|---|---|---|
| k9s | Terminal UI for Kubernetes | `brew install k9s` |
| stern | Multi-pod log tailing | `brew install stern` |
| kubectx/kubens | Context and namespace switching | `brew install kubectx` |
| Lens | Kubernetes IDE | [k8slens.dev](https://k8slens.dev) |

### Access Requirements

Before starting, ensure you have:

- [ ] GitHub access to the `printforge` organization
- [ ] AWS SSO access (request via IT ticket if needed)
- [ ] Slack access to `#platform-engineering` and `#dev-help` channels
- [ ] 1Password vault access for shared development secrets

## Step 1: Clone Repositories

```bash
# Create a workspace directory
mkdir -p ~/workspace/printforge && cd ~/workspace/printforge

# Clone all service repositories
git clone git@github.com:printforge/marketplace-web.git
git clone git@github.com:printforge/product-service.git
git clone git@github.com:printforge/artist-service.git
git clone git@github.com:printforge/search-service.git
git clone git@github.com:printforge/platform-charts.git
git clone git@github.com:printforge/infrastructure.git
```

## Step 2: Docker Compose Setup (Quick Start)

For quick local development without Kubernetes, use Docker Compose. This starts all services with their dependencies.

```bash
cd ~/workspace/printforge/infrastructure/docker

# Copy the example environment file
cp .env.example .env
# Edit .env with your local settings (database passwords, etc.)

# Start all services
docker compose up -d

# Verify everything is running
docker compose ps

# Expected output:
# NAME                  STATUS    PORTS
# marketplace-web       running   0.0.0.0:3000->3000/tcp
# product-service       running   0.0.0.0:8080->8080/tcp
# artist-service        running   0.0.0.0:8081->8081/tcp
# search-service        running   0.0.0.0:8082->8082/tcp
# postgres              running   0.0.0.0:5432->5432/tcp
# redis                 running   0.0.0.0:6379->6379/tcp
# opensearch            running   0.0.0.0:9200->9200/tcp

# Seed the database
docker compose exec product-service make db-seed

# View logs
docker compose logs -f product-service
```

### Docker Compose Service URLs

| Service | URL | Purpose |
|---|---|---|
| marketplace-web | http://localhost:3000 | Storefront UI |
| product-service | http://localhost:8080 | API endpoints |
| artist-service | http://localhost:8081 | Artist API |
| search-service | http://localhost:8082 | Search API |
| PostgreSQL | localhost:5432 | Database (user: printforge, pass: in .env) |
| Redis | localhost:6379 | Cache and sessions |
| OpenSearch | http://localhost:9200 | Search engine |
| OpenSearch Dashboards | http://localhost:5601 | Search UI |

### Stopping Docker Compose

```bash
# Stop services (preserves data)
docker compose stop

# Stop and remove containers, networks (preserves volumes)
docker compose down

# Stop and remove everything including volumes (full reset)
docker compose down -v
```

## Step 3: Kind Cluster Setup (Full Kubernetes)

For testing Kubernetes-specific features (Helm charts, network policies, HPA), use a Kind cluster.

### Create the Cluster

```bash
cd ~/workspace/printforge/infrastructure/kind

# Create Kind cluster with custom configuration
kind create cluster --config kind-config.yaml --name printforge

# Verify cluster is running
kubectl cluster-info --context kind-printforge

# Set kubectl context
kubectl config use-context kind-printforge
```

Kind cluster configuration (`kind-config.yaml`):

```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: printforge
nodes:
  - role: control-plane
    extraPortMappings:
      - containerPort: 80
        hostPort: 80
        protocol: TCP
      - containerPort: 443
        hostPort: 443
        protocol: TCP
  - role: worker
  - role: worker
```

### Install Platform Components

```bash
# Install NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

# Wait for ingress controller to be ready
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s

# Install Prometheus and Grafana (via Helm)
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm install monitoring prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace \
  -f ~/workspace/printforge/platform-charts/monitoring/values-local.yaml
```

### Deploy Services to Kind

```bash
cd ~/workspace/printforge/platform-charts

# Build local images and load into Kind
for svc in marketplace-web product-service artist-service search-service; do
  cd ~/workspace/printforge/$svc
  docker build -t printforge/$svc:local .
  kind load docker-image printforge/$svc:local --name printforge
done

# Deploy using Helm
cd ~/workspace/printforge/platform-charts
helm install product-service charts/product-service \
  -n marketplace --create-namespace \
  -f charts/product-service/values-local.yaml

helm install marketplace-web charts/marketplace-web \
  -n marketplace \
  -f charts/marketplace-web/values-local.yaml

helm install artist-service charts/artist-service \
  -n marketplace \
  -f charts/artist-service/values-local.yaml

helm install search-service charts/search-service \
  -n marketplace \
  -f charts/search-service/values-local.yaml

# Verify all pods are running
kubectl -n marketplace get pods
```

### Accessing Services in Kind

```bash
# Port-forward to individual services
kubectl -n marketplace port-forward svc/marketplace-web 3000:80 &
kubectl -n marketplace port-forward svc/product-service 8080:80 &

# Access Grafana
kubectl -n monitoring port-forward svc/monitoring-grafana 3001:80 &
# URL: http://localhost:3001 (admin/prom-operator)

# Access Prometheus
kubectl -n monitoring port-forward svc/monitoring-prometheus 9090:9090 &
# URL: http://localhost:9090
```

### Deleting the Kind Cluster

```bash
kind delete cluster --name printforge
```

## Step 4: AWS SSO Login

For accessing staging/production resources (ECR images, secrets, logs):

```bash
# Configure AWS SSO
aws configure sso
# SSO start URL: https://printforge.awsapps.com/start
# SSO Region: us-west-2
# Account: select your development account
# Role: DeveloperAccess
# Profile name: printforge-dev

# Login
aws sso login --profile printforge-dev

# Verify access
aws sts get-caller-identity --profile printforge-dev

# Configure kubectl for EKS staging access
aws eks update-kubeconfig \
  --name printforge-staging \
  --profile printforge-dev \
  --region us-west-2 \
  --alias staging
```

## Common Commands Reference

### Docker Compose

```bash
docker compose up -d              # Start all services
docker compose down               # Stop all services
docker compose logs -f <service>  # Tail logs for a service
docker compose exec <svc> sh      # Shell into a container
docker compose build <service>    # Rebuild a service image
docker compose restart <service>  # Restart a service
```

### Kubernetes (Kind / Staging)

```bash
kubectl -n marketplace get pods              # List pods
kubectl -n marketplace logs -f <pod>         # Tail pod logs
kubectl -n marketplace exec -it <pod> -- sh  # Shell into pod
kubectl -n marketplace describe pod <pod>    # Pod details
kubectl -n marketplace get events            # Recent events
helm list -n marketplace                     # List Helm releases
helm upgrade <release> <chart> -n marketplace -f values.yaml  # Update release
```

### Building and Testing

```bash
make lint          # Run linters
make test          # Run unit tests
make test-integ    # Run integration tests
make docker-build  # Build Docker image
make docker-push   # Push to ECR (requires AWS login)
```

## Troubleshooting

### Docker Compose

| Problem | Solution |
|---|---|
| Port already in use | `lsof -i :<port>` to find the process, then kill it |
| Database connection refused | Check if postgres container is healthy: `docker compose ps` |
| Out of disk space | `docker system prune -a` to clean unused images |
| Service cannot reach another service | Services use Docker network DNS: use service name, not localhost |

### Kind Cluster

| Problem | Solution |
|---|---|
| Pods stuck in Pending | Check node resources: `kubectl describe node` |
| Image pull error | Ensure image is loaded: `kind load docker-image <image> --name printforge` |
| Ingress not working | Verify ingress controller: `kubectl -n ingress-nginx get pods` |
| Helm install fails | Check values file: `helm template <chart> -f values.yaml` to debug |

### AWS Access

| Problem | Solution |
|---|---|
| SSO token expired | Run `aws sso login --profile printforge-dev` |
| ECR login expired | Run `aws ecr get-login-password --region us-west-2 \| docker login --username AWS --password-stdin <account>.dkr.ecr.us-west-2.amazonaws.com` |
| kubectl access denied | Re-run `aws eks update-kubeconfig` with correct profile |

## Getting Help

- **Slack**: #dev-help for general questions, #platform-engineering for infrastructure issues
- **Documentation**: This docs/ directory and the ADRs
- **Pairing**: Grab a time slot on the Platform Engineering team calendar for onboarding pairing sessions
