# Artist Marketplace — Architecture

Multi-region, event-driven marketplace platform on AWS.

## Regions

- **us-east-1** — primary
- **ap-southeast-2** — secondary (AU failover)
- Route 53 latency-based routing with health-check failover between regions.

## Compute

- **EKS** (Kubernetes 1.30) runs the three core FastAPI microservices:
  - `artist-service`
  - `product-service`
  - `order-service`
- **ECS Fargate** runs the simulated legacy `monolith-service` (Flask) to
  demonstrate multi-orchestrator experience.

## Data

- **RDS (PostgreSQL, Multi-AZ)** — orders, artists, products
- **SQS** — `design-events` queue carries async events between services
- **S3** — artist uploads (artwork assets)

## Networking

- VPC per region with two AZs, private + public subnets
- One NAT gateway per AZ (HA)
- ALB in front of EKS ingress; ALB in front of ECS service

## CI/CD

- **GitHub Actions** builds, tests, and pushes images to ECR
- **Buildkite** deploys via Helm with staging → manual gate → production
- Rolling updates with `maxSurge: 1, maxUnavailable: 0` for zero-downtime

## Observability

- Prometheus scrapes `/metrics` on each service via ServiceMonitor
- Grafana dashboards per service and per SLO
- k6 load test simulates Black Friday traffic (3× baseline)

## SLOs

See [slo.md](./slo.md).
