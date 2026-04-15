# Artist Marketplace Platform

**Author:** John Gomez

Portfolio DevOps build: global, multi-region artist marketplace demonstrating
EKS + ECS, Terraform, Helm, GitHub Actions + Buildkite CI/CD, SLOs, and k6
load testing.

```
artist-marketplace/
├── services/
│   ├── artist-service/      # FastAPI
│   ├── product-service/     # FastAPI
│   ├── order-service/       # FastAPI (SLO target)
│   └── monolith-service/    # Flask (simulated legacy)
├── infra/terraform/         # VPC / EKS / ECS / RDS / SQS, us-east-1 + ap-southeast-2
├── helm/                    # One chart per service
├── .github/workflows/ci.yml # Build, test, push to ECR, trigger Buildkite
├── .buildkite/pipeline.yml  # Helm deploy → staging → manual gate → prod
├── k6/black-friday.js       # 3× Black Friday load test
└── docs/                    # Architecture, SLOs, incident response
```

## Quickstart (local dev)

```bash
cd services/order-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
curl -X POST http://localhost:8080/orders -H 'content-type: application/json' -d '{"product_id":"sku_001","quantity":1}'
```

## Run tests

```bash
cd services/order-service && pytest -v
```

## Terraform

```bash
cd infra/terraform/environments/us-east-1
terraform init && terraform plan
```

## Deploy (via Helm)

```bash
helm upgrade --install order-service ./helm/order-service \
  --namespace staging --set image.tag=$(git rev-parse HEAD)
```

## Load test

```bash
k6 run k6/black-friday.js
```

See [docs/architecture.md](docs/architecture.md) and
[docs/incident-response.md](docs/incident-response.md) for the full writeup.
