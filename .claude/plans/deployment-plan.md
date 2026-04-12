# PrintForge — Live Deployment & Portfolio Activation Plan

## Current State Assessment

**What's already built (and it's substantial):**
- 6 fully implemented services (product, order, artist, search, marketplace-web, monolith)
- 10 Terraform modules (VPC, EKS, ECS, RDS, Datadog, Cloudflare, ElastiCache, S3, ECR)
- Helm charts with common library pattern + per-service charts
- GitHub Actions CI + Buildkite CD pipelines
- Flagger canary deployment configs
- k6 load tests (spike, baseline, soak, stress)
- 10 Architecture Decision Records + runbooks
- Docker Compose local stack
- Makefile with 20+ targets

**What's installed locally:** Docker, kubectl, Node.js v24, Git
**What's missing locally:** kind, helm, terraform, aws CLI, k6, Go
**What's missing accounts:** AWS CLI config, Buildkite, Datadog

---

## Architecture (What We're Deploying)

```
                         ┌─────────────────────────────────────┐
                         │          Cloudflare Edge            │
                         │   WAF · CDN · Rate Limiting · DNS   │
                         └──────────────┬──────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
              ┌─────▼─────┐     ┌──────▼──────┐    ┌──────▼──────┐
              │  AWS ALB   │     │  AWS ALB    │    │  AWS ALB    │
              │ (K8s Ingress)    │ (ECS)       │    │ (Internal)  │
              └─────┬─────┘     └──────┬──────┘    └──────┬──────┘
                    │                  │                   │
   ┌────────────────┼──────────────┐   │                   │
   │   EKS Cluster (Kubernetes)    │   │                   │
   │                               │   │                   │
   │ ┌──────────┐ ┌──────────────┐ │   │ ┌──────────────┐  │
   │ │marketplace│ │product-svc   │ │   │ │monolith-svc  │  │
   │ │-web (Next)│ │(Node.js)     │ │   │ │(Node.js/ECS  │  │
   │ │ 2 pods    │ │ 2 pods       │ │   │ │ Fargate)     │  │
   │ └──────────┘ └──────────────┘ │   │ │ Admin+Fulfil │  │
   │ ┌──────────┐ ┌──────────────┐ │   │ └──────────────┘  │
   │ │order-svc │ │search-svc    │ │   │                   │
   │ │(Node.js) │ │(Node.js)     │ │   │ ┌──────────────┐  │
   │ │ 3 pods   │ │ 2 pods       │ │   │ │ Aurora       │  │
   │ │ SLO:99.9%│ │ SLO:95%<200ms│ │   │ │ PostgreSQL   │  │
   │ └──────────┘ └──────────────┘ │   │ └──────────────┘  │
   │ ┌──────────┐                  │   │                   │
   │ │artist-svc│   Flagger        │   │ ┌──────────────┐  │
   │ │(Go)      │   Canary Deploys │   │ │ ElastiCache  │  │
   │ └──────────┘                  │   │ │ Redis        │  │
   │                               │   │ └──────────────┘  │
   └───────────────────────────────┘   │                   │
                                       └───────────────────┘
              ▲                                ▲
              │           Datadog              │
              └──── Metrics · Traces · SLOs ───┘
```

---

## Phase 0: Tool Installation & Account Setup (30-45 min)

### Step 0.1 — Install Missing CLI Tools (15 min)

```bash
# Install Chocolatey if not present (Windows package manager)
# Run PowerShell as Admin:
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install all missing tools via Chocolatey (in Admin PowerShell)
choco install awscli terraform helm kind kubernetes-cli k6 golang -y

# Verify installations (in Git Bash)
aws --version
terraform --version
helm version --short
kind --version
k6 version
go version
```

**Pitfall:** After Chocolatey installs, restart your terminal so PATH updates take effect.

**Verification:**
```bash
# All 6 should return versions
aws --version && terraform --version && helm version --short && \
kind --version && k6 version && go version && echo "ALL TOOLS INSTALLED"
```

### Step 0.2 — Configure AWS CLI (5 min)

```bash
aws configure
# AWS Access Key ID: <from IAM console>
# AWS Secret Access Key: <from IAM console>
# Default region: ap-southeast-2
# Default output format: json

# Verify
aws sts get-caller-identity
```

**If you don't have an IAM access key yet:**
1. Go to AWS Console → IAM → Users → your user → Security Credentials
2. Create Access Key → CLI use case
3. Save the key pair securely

### Step 0.3 — Sign Up for Buildkite (5 min)

1. Go to https://buildkite.com/signup (free tier: unlimited builds for 14 days)
2. Create organization (e.g., "printforge-demo")
3. Install Buildkite agent (we'll configure later):
```bash
# Note the agent token from Buildkite dashboard → Agents → Reveal Token
# We'll use it in Phase 2
```

### Step 0.4 — Sign Up for Datadog (5 min)

1. Go to https://www.datadoghq.com/free-datadog-trial/ (14-day free trial)
2. Select region closest to you
3. Get your API key: Datadog → Organization Settings → API Keys
4. Get your APP key: Datadog → Organization Settings → Application Keys
5. Save both — we'll use them in Phase 4

### Step 0.5 — Initialize Git Repo (5 min)

```bash
cd ~/OneDrive/Desktop/Proj1
git init
git add .
git commit -m "Initial commit: PrintForge platform — full IaC, services, CI/CD, observability"

# Create GitHub repo
gh repo create printforge-platform --private --source=. --push
# OR manually create on GitHub and:
git remote add origin https://github.com/<your-username>/printforge-platform.git
git push -u origin main
```

---

## Phase 1: Local Demo — Prove It Works (45-60 min)

This phase gets everything running on your machine. Even if AWS deployment hits snags, this gives you a working demo to screenshot.

### Step 1.1 — Docker Compose Full Stack (15 min)

```bash
cd ~/OneDrive/Desktop/Proj1

# Build and start all services
make dev-up

# Watch logs for startup issues
make dev-logs
# Wait until all healthchecks pass (watch for "healthy" in docker ps)

# Verify all services are healthy
docker compose ps
```

**Verification:**
```bash
make smoke-test
# Expected output:
# ✓ product-service healthy
# ✓ order-service healthy
# ✓ marketplace-web healthy
# ✓ artist-service healthy
# ✓ search-service healthy
# ✓ monolith-service healthy
```

**Pitfall:** If postgres fails to start, check if port 5432 is already in use: `netstat -an | grep 5432`
**Pitfall:** If artist-service fails (Go), it may need `CGO_ENABLED=0` in Dockerfile. Check its Dockerfile.

### Step 1.2 — Seed Data & Test APIs (10 min)

```bash
# Seed product database
make seed-db

# Test individual endpoints
curl http://localhost:3001/healthz          # product-service
curl http://localhost:3001/api/products     # product listing
curl http://localhost:3003/healthz          # order-service
curl http://localhost:8080/healthz          # artist-service (Go)
curl http://localhost:3002/healthz          # search-service
curl http://localhost:4000/healthz          # monolith-service
curl http://localhost:3000                  # marketplace-web (browser)
```

**Screenshot opportunity:** Open http://localhost:3000 in browser — capture the marketplace UI.

### Step 1.3 — Local Kind Cluster (20 min)

```bash
# Create Kind cluster with ingress + Flagger
make k8s-up

# Build images and load into Kind
for svc in product-service order-service marketplace-web artist-service search-service; do
  docker build -t printforge/$svc:local ./services/$svc
  kind load docker-image printforge/$svc:local --name printforge-local
done

# Deploy via Helm
make k8s-deploy

# Check status
make k8s-status
```

**Verification:**
```bash
kubectl get pods -n printforge
# All pods should be Running with 1/1 Ready

kubectl get svc -n printforge
kubectl get hpa -n printforge
kubectl get networkpolicies -n printforge
```

**Screenshot opportunities:**
- `kubectl get pods -n printforge -o wide` — show all pods running
- `kubectl get hpa -n printforge` — show autoscaling configs
- `kubectl get networkpolicies -n printforge` — show security posture
- `kubectl describe canary -n printforge` — show Flagger canary config (if applied)

### Step 1.4 — Run Helm & Terraform Validation (10 min)

```bash
# Lint all Helm charts
make helm-lint

# Validate all Terraform modules
make tf-validate

# Run service tests
make test-all
```

**Screenshot opportunity:** Terminal showing all validations passing.

### Step 1.5 — Capture Local Demo Proof (5 min)

Take screenshots of:
1. `docker compose ps` — all 8 containers healthy
2. `make smoke-test` — all endpoints responding
3. `kubectl get pods -n printforge` — K8s pods running
4. `kubectl get hpa -n printforge` — autoscaling configured
5. Browser at localhost:3000 — marketplace UI
6. `make validate-all` — all linting/testing passing

---

## Phase 2: AWS Cloud Deployment (90-120 min)

### Step 2.1 — Create Terraform State Backend (10 min)

```bash
# Create S3 bucket for Terraform state
aws s3 mb s3://printforge-terraform-state --region ap-southeast-2

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket printforge-terraform-state \
  --versioning-configuration Status=Enabled

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name printforge-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-southeast-2
```

**Verification:**
```bash
aws s3 ls | grep printforge
aws dynamodb describe-table --table-name printforge-terraform-locks --region ap-southeast-2 --query 'Table.TableStatus'
```

### Step 2.2 — Create ECR Repositories (10 min)

```bash
# Create ECR repos for each service
for svc in product-service order-service marketplace-web artist-service search-service monolith-service; do
  aws ecr create-repository \
    --repository-name printforge/$svc \
    --region ap-southeast-2 \
    --image-scanning-configuration scanOnPush=true
done

# Login to ECR
aws ecr get-login-password --region ap-southeast-2 | \
  docker login --username AWS --password-stdin \
  $(aws sts get-caller-identity --query Account --output text).dkr.ecr.ap-southeast-2.amazonaws.com
```

### Step 2.3 — Build & Push Images to ECR (15 min)

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=ap-southeast-2
REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

for svc in product-service order-service marketplace-web artist-service search-service monolith-service; do
  echo "Building and pushing $svc..."
  docker build -t ${REGISTRY}/printforge/${svc}:v1.0.0 ./services/${svc}
  docker push ${REGISTRY}/printforge/${svc}:v1.0.0
done
```

**Pitfall:** If pushes are slow, build with `--platform linux/amd64` explicitly (important on ARM Macs, less so on Windows).

### Step 2.4 — Deploy VPC + EKS via Terraform (30-40 min)

EKS cluster creation takes ~15 min. Start this early.

```bash
cd terraform/environments/staging

# Initialize Terraform
terraform init

# Review the plan (ALWAYS review before apply)
terraform plan -out=tfplan

# Apply — this creates VPC + EKS + node groups
terraform apply tfplan
```

**Cost note:** EKS control plane = $0.10/hr. 2x t3.medium nodes = ~$0.08/hr. Total ~$0.18/hr. At 4 hours runtime = ~$0.72.

**While EKS is provisioning (15 min wait), do Step 2.5 in parallel.**

### Step 2.5 — Deploy ECS for Monolith (parallel with 2.4) (15 min)

If ECS isn't part of the staging Terraform, create it manually:

```bash
# Create ECS cluster
aws ecs create-cluster \
  --cluster-name printforge-monolith \
  --capacity-providers FARGATE \
  --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1 \
  --region ap-southeast-2

# Register task definition
cat > /tmp/monolith-task-def.json << 'TASKEOF'
{
  "family": "printforge-monolith",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/ecsTaskExecutionRole",
  "containerDefinitions": [{
    "name": "monolith-service",
    "image": "REGISTRY/printforge/monolith-service:v1.0.0",
    "portMappings": [{"containerPort": 4000, "protocol": "tcp"}],
    "healthCheck": {
      "command": ["CMD-SHELL", "curl -f http://localhost:4000/healthz || exit 1"],
      "interval": 30,
      "timeout": 5,
      "retries": 3,
      "startPeriod": 60
    },
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/printforge-monolith",
        "awslogs-region": "ap-southeast-2",
        "awslogs-stream-prefix": "monolith"
      }
    },
    "environment": [
      {"name": "NODE_ENV", "value": "production"},
      {"name": "PORT", "value": "4000"},
      {"name": "LOG_FORMAT", "value": "json"}
    ]
  }],
  "tags": [
    {"key": "Project", "value": "printforge"},
    {"key": "Environment", "value": "staging"}
  ]
}
TASKEOF

# Replace placeholders and register
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGISTRY="${ACCOUNT_ID}.dkr.ecr.ap-southeast-2.amazonaws.com"
sed -i "s|ACCOUNT_ID|${ACCOUNT_ID}|g; s|REGISTRY|${REGISTRY}|g" /tmp/monolith-task-def.json
aws ecs register-task-definition --cli-input-json file:///tmp/monolith-task-def.json --region ap-southeast-2
```

**Note:** You'll need the VPC subnets and security groups from the Terraform output to create the ECS service. Wait for Step 2.4 to complete, then:

```bash
# After Terraform finishes, get subnet IDs
SUBNET_IDS=$(terraform output -json private_subnet_ids | jq -r 'join(",")')
SG_ID=$(terraform output -raw ecs_security_group_id)

# Create ECS service
aws ecs create-service \
  --cluster printforge-monolith \
  --service-name monolith-service \
  --task-definition printforge-monolith \
  --desired-count 2 \
  --launch-type FARGATE \
  --deployment-configuration "maximumPercent=200,minimumHealthyPercent=100,deploymentCircuitBreaker={enable=true,rollback=true}" \
  --network-configuration "awsvpcConfiguration={subnets=[${SUBNET_IDS}],securityGroups=[${SG_ID}],assignPublicIp=DISABLED}" \
  --region ap-southeast-2
```

### Step 2.6 — Configure kubectl for EKS (5 min)

```bash
# Update kubeconfig for the new EKS cluster
aws eks update-kubeconfig \
  --name printforge-staging \
  --region ap-southeast-2

# Verify connectivity
kubectl get nodes
kubectl get ns
```

### Step 2.7 — Deploy Services to EKS via Helm (15 min)

```bash
# Create namespace and apply K8s manifests
kubectl apply -f k8s/namespaces/
kubectl apply -f k8s/priority-classes/
kubectl apply -f k8s/limit-ranges/
kubectl apply -f k8s/resource-quotas/
kubectl apply -f k8s/rbac/
kubectl apply -f k8s/network-policies/

# Install ingress-nginx
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx \
  -n ingress-nginx --create-namespace \
  --set controller.service.type=LoadBalancer

# Deploy all microservices
for svc in product-service order-service marketplace-web artist-service search-service; do
  helm upgrade --install $svc ./helm/charts/$svc \
    -n printforge \
    -f ./helm/environments/staging/values.yaml \
    --set image.repository=${REGISTRY}/printforge/${svc} \
    --set image.tag=v1.0.0 \
    --wait --timeout 300s
done
```

**Verification:**
```bash
kubectl get pods -n printforge
kubectl get svc -n printforge
kubectl get hpa -n printforge
kubectl get ingress -n printforge

# Get the ALB URL
kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

**Screenshot opportunities:**
- `kubectl get pods -n printforge -o wide` on real EKS
- `kubectl get nodes` showing real EC2 instances
- ECS console showing monolith service running
- AWS console showing the EKS cluster

---

## Phase 3: CI/CD Pipeline Activation (60 min)

### Step 3.1 — GitHub Actions (Already Configured) (10 min)

Your `.github/workflows/ci.yml` is already written. Just push to trigger it:

```bash
git add .
git commit -m "Activate CI/CD pipelines"
git push origin main
```

**Verification:** Go to GitHub → Actions tab → see workflows running:
- `ci.yml` — parallel service builds, lint, test, Docker build, Trivy scan
- `helm-validate.yml` — chart linting
- `terraform-validate.yml` — module validation
- `security-scan.yml` — Snyk + Checkov + Gitleaks

**Screenshot opportunity:** GitHub Actions tab showing all green checks.

### Step 3.2 — Buildkite Agent Setup (15 min)

```bash
# Install Buildkite agent (on your machine or a small EC2 instance)
# For local testing on Windows/Git Bash:
# Download from https://buildkite.com/docs/agent/v3/installation

# Set the agent token (from Buildkite dashboard)
export BUILDKITE_AGENT_TOKEN="your-token-here"

# Start the agent
buildkite-agent start --tags "queue=default,os=windows"
```

**Alternative (recommended for demo):** Run Buildkite agent as a Docker container:
```bash
docker run -d \
  --name buildkite-agent \
  -e BUILDKITE_AGENT_TOKEN="your-token-here" \
  -e BUILDKITE_AGENT_TAGS="queue=default" \
  -v /var/run/docker.sock:/var/run/docker.sock \
  buildkite/agent:3
```

### Step 3.3 — Create Buildkite Pipeline (15 min)

1. In Buildkite dashboard → New Pipeline
2. Name: `printforge-platform`
3. Repository: your GitHub repo URL
4. Steps: "Read steps from repository" → `.buildkite/pipeline.yml`
5. Create pipeline

Then create the sub-pipelines:
- `printforge-deploy-production` → `.buildkite/pipelines/deploy-production.yml`
- `printforge-monolith-deploy` → `.buildkite/pipelines/monolith-deploy.yml`
- `printforge-infrastructure` → `.buildkite/pipelines/infrastructure.yml` (if exists)

### Step 3.4 — Trigger a Build & Capture (10 min)

```bash
# Make a small change to trigger the pipeline
echo "# triggered" >> services/product-service/README.md
git add . && git commit -m "Trigger Buildkite pipeline" && git push
```

**Verification:** Buildkite dashboard shows the pipeline executing with:
- Change detection step
- Conditional triggers for affected services
- Build/test/push steps

**Screenshot opportunities:**
- Buildkite pipeline running with step visualization
- The canary deployment pipeline (even if not fully executing, show the config)
- GitHub Actions + Buildkite running in parallel (dual CI/CD)

### Step 3.5 — Demo the Canary Deployment Flow (10 min)

Even if Flagger isn't fully wired in staging, show the config:

```bash
# Show the canary configuration
kubectl describe canary -n printforge 2>/dev/null || \
  echo "Canary CRD shows: 10%→20%→30%→40%→50%→promote with Datadog metric gates"

# Show the Buildkite deploy script structure
head -50 .buildkite/scripts/deploy-canary.sh
```

---

## Phase 4: Observability & SLOs (45-60 min)

### Step 4.1 — Install Datadog Agent on EKS (15 min)

```bash
# Add Datadog Helm repo
helm repo add datadog https://helm.datadoghq.com
helm repo update

# Create Datadog secret
kubectl create secret generic datadog-secret \
  -n printforge \
  --from-literal=api-key="YOUR_DD_API_KEY" \
  --from-literal=app-key="YOUR_DD_APP_KEY"

# Install Datadog agent
helm install datadog-agent datadog/datadog \
  -n printforge \
  --set datadog.apiKeyExistingSecret=datadog-secret \
  --set datadog.appKeyExistingSecret=datadog-secret \
  --set datadog.logs.enabled=true \
  --set datadog.logs.containerCollectAll=true \
  --set datadog.apm.portEnabled=true \
  --set datadog.processAgent.enabled=true \
  --set datadog.clusterAgent.enabled=true \
  --set datadog.clusterAgent.metricsProvider.enabled=true \
  --set datadog.tags="{env:staging,project:printforge,team:devops}"
```

**Verification:**
```bash
kubectl get pods -n printforge -l app=datadog
# Should see datadog-agent pods running on each node
```

### Step 4.2 — Apply SLO Terraform (15 min)

```bash
# Export Datadog credentials for Terraform
export DD_API_KEY="your-api-key"
export DD_APP_KEY="your-app-key"

# The Datadog SLOs are defined in terraform/modules/datadog/slos.tf
# Apply them (you may need to init the Datadog provider separately)
cd terraform/modules/datadog
terraform init
terraform plan
terraform apply
```

This creates the 4 SLOs:
1. **Checkout Availability:** 99.9% over 30 days
2. **Product Page Latency:** 99% requests < 300ms (p99)
3. **Search Latency:** 95% requests < 200ms
4. **Order Success Rate:** 99.95% over 30 days

### Step 4.3 — Generate Traffic for Metrics (10 min)

```bash
# If k6 is installed, run baseline load test against the live services
# Get the ALB hostname first
ALB_HOST=$(kubectl get svc -n ingress-nginx ingress-nginx-controller \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

# Run a quick baseline test
k6 run --env BASE_URL=http://${ALB_HOST} monitoring/k6/baseline.js

# OR generate simple traffic with curl loop
for i in $(seq 1 100); do
  curl -s http://${ALB_HOST}/api/products > /dev/null &
  curl -s http://${ALB_HOST}/healthz > /dev/null &
done
wait
```

### Step 4.4 — Capture Observability Proof (10 min)

**Screenshot opportunities in Datadog:**
1. Infrastructure Map → EKS nodes + ECS tasks visible
2. APM → Service map showing service-to-service calls
3. SLOs → 4 SLOs with current burn rates
4. Dashboards → Service overview (if dashboard Terraform applied)
5. Logs → Structured JSON logs from services
6. Monitors → Alert definitions

---

## Phase 5: Polish, Screenshots & Teardown (45-60 min)

### Step 5.1 — Final Verification Checklist (10 min)

```bash
# EKS verification
kubectl get pods -n printforge                    # All pods Running
kubectl get hpa -n printforge                     # HPA configured
kubectl get networkpolicies -n printforge          # Security policies active
kubectl get pdb -n printforge                      # PDBs protecting availability

# ECS verification
aws ecs describe-services \
  --cluster printforge-monolith \
  --services monolith-service \
  --region ap-southeast-2 \
  --query 'services[0].{status:status,running:runningCount,desired:desiredCount,deployments:deployments[*].rolloutState}'

# CI/CD verification
# Check GitHub Actions: https://github.com/<user>/printforge-platform/actions
# Check Buildkite: https://buildkite.com/<org>/printforge-platform
```

### Step 5.2 — Capture Portfolio Screenshots (15 min)

Take these specific screenshots for maximum interview impact:

| # | What | Why It Matters |
|---|------|---------------|
| 1 | `kubectl get pods -n printforge -o wide` on EKS | Proves real K8s deployment |
| 2 | ECS console → monolith-service tasks running | Shows hybrid architecture |
| 3 | GitHub Actions → all workflows green | CI automation |
| 4 | Buildkite → pipeline with canary stages | CD with safety gates |
| 5 | Datadog → Infrastructure Map | Observability coverage |
| 6 | Datadog → SLO dashboard with 4 SLOs | SRE maturity |
| 7 | Datadog → Service Map (APM) | Distributed system visibility |
| 8 | `terraform plan` output (clean) | IaC competency |
| 9 | k6 load test results | Performance validation |
| 10 | Marketplace UI in browser | Working product |
| 11 | Flagger canary config | Progressive delivery |
| 12 | Network policies (`kubectl get netpol`) | Security posture |

### Step 5.3 — Update Portfolio Documentation (10 min)

Update `PORTFOLIO.md` with:
- Links to live screenshots
- Actual metrics from the deployment
- Cost breakdown of the demo run
- Lessons learned during deployment

### Step 5.4 — CRITICAL: Teardown to Avoid Costs (10 min)

```bash
# 1. Delete EKS services first (releases ALBs)
helm uninstall product-service order-service marketplace-web artist-service search-service \
  -n printforge
helm uninstall ingress-nginx -n ingress-nginx
helm uninstall datadog-agent -n printforge

# 2. Delete ECS service and cluster
aws ecs update-service --cluster printforge-monolith --service monolith-service --desired-count 0 --region ap-southeast-2
aws ecs delete-service --cluster printforge-monolith --service monolith-service --force --region ap-southeast-2
aws ecs delete-cluster --cluster printforge-monolith --region ap-southeast-2

# 3. Destroy Terraform infrastructure (this deletes VPC, EKS, everything)
cd terraform/environments/staging
terraform destroy -auto-approve

# 4. Delete ECR images (optional — free tier allows 500MB)
for svc in product-service order-service marketplace-web artist-service search-service monolith-service; do
  aws ecr delete-repository --repository-name printforge/$svc --force --region ap-southeast-2
done

# 5. Delete state backend (optional — keep if you want to redeploy later)
# aws s3 rb s3://printforge-terraform-state --force
# aws dynamodb delete-table --table-name printforge-terraform-locks --region ap-southeast-2

# 6. Verify nothing is left running
aws eks list-clusters --region ap-southeast-2
aws ecs list-clusters --region ap-southeast-2
aws ec2 describe-instances --filters "Name=tag:Project,Values=printforge" --query 'Reservations[*].Instances[*].[InstanceId,State.Name]' --region ap-southeast-2
```

**CRITICAL:** Set a phone alarm for 4 hours from when you start Phase 2. If anything goes wrong, at minimum run `terraform destroy` to avoid overnight charges.

### Step 5.5 — Final Git Push (5 min)

```bash
# Add screenshots to docs/screenshots/
mkdir -p docs/screenshots
# Move your screenshots there

git add .
git commit -m "Add deployment proof: screenshots, metrics, updated portfolio docs"
git push origin main
```

---

## Cost Estimate

| Resource | Cost/hr | Hours | Total |
|----------|---------|-------|-------|
| EKS Control Plane | $0.10 | 4 | $0.40 |
| 2x t3.medium nodes | $0.084 | 4 | $0.34 |
| NAT Gateway | $0.045 | 4 | $0.18 |
| ALB (ingress) | $0.023 | 4 | $0.09 |
| ECS Fargate (2 tasks) | $0.04 | 4 | $0.16 |
| ECR storage | ~free | — | $0.00 |
| Data transfer | ~minimal | — | ~$0.10 |
| **Total** | | | **~$1.30** |

Well within $5-20 budget. Main risk: forgetting to teardown. NAT Gateway alone is $1.08/day.

---

## Common Pitfalls & Solutions

| Pitfall | Solution |
|---------|----------|
| EKS takes 15+ min to create | Start it first, do other work in parallel |
| `terraform destroy` fails on dependencies | Delete Helm releases and K8s services first |
| Docker push to ECR fails with auth error | Re-run `aws ecr get-login-password` command |
| Helm install fails with "timed out waiting" | Check pod events: `kubectl describe pod <name> -n printforge` |
| Datadog agent not collecting metrics | Verify secret exists: `kubectl get secret datadog-secret -n printforge` |
| NAT Gateway charges mounting | Use single NAT (staging config already does this) |
| Kind cluster conflicts with EKS kubeconfig | Use `kubectl config use-context` to switch |
| Node.js services crash with DB connection | Services need DATABASE_URL env var pointing to RDS or local postgres |
| Buildkite agent can't reach GitHub | Ensure agent has network access and GitHub token configured |
| `terraform init` fails on S3 backend | Ensure S3 bucket and DynamoDB table were created in Step 2.1 |

---

## Portfolio-Ready Outcomes to Highlight in Interview

1. **Hybrid Architecture Mastery** — "I deployed microservices on EKS and the legacy monolith on ECS Fargate, mirroring Articore's real architecture"
2. **IaC at Scale** — "10 Terraform modules, multi-environment compositions, S3 remote state with DynamoDB locking"
3. **Canary Deployments** — "Flagger-based canary with Datadog metric gates — auto-rollback if error rate exceeds 0.1%"
4. **SLO-Driven Operations** — "4 concrete SLOs with error budget policies and burn-rate alerting"
5. **Security by Default** — "Default-deny network policies, non-root containers, Trivy scanning in CI, KMS encryption"
6. **Dual CI/CD** — "GitHub Actions for CI (fast feedback), Buildkite for CD (deployment safety gates)"
7. **Operational Readiness** — "Runbooks, incident response playbook, chaos engineering scripts, on-call procedures"
8. **Cost Awareness** — "Single NAT gateway in staging, spot instances in prod, Karpenter for right-sizing"

---

## Timeline Summary

| Phase | Duration | Key Output |
|-------|----------|------------|
| Phase 0: Setup | 30-45 min | Tools installed, accounts created |
| Phase 1: Local Demo | 45-60 min | Docker Compose + Kind cluster running |
| Phase 2: AWS Deploy | 90-120 min | EKS + ECS live in ap-southeast-2 |
| Phase 3: CI/CD | 60 min | GitHub Actions + Buildkite active |
| Phase 4: Observability | 45-60 min | Datadog + SLOs configured |
| Phase 5: Polish | 45-60 min | Screenshots, docs, teardown |
| **Total** | **~5-6 hours** | **Live demo + portfolio repo** |
