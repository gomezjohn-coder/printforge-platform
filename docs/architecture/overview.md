# PrintForge Architecture Overview

**Last Updated**: 2026-04-09
**Owner**: Platform Engineering Team

## System Overview

PrintForge is a print-on-demand marketplace connecting artists with customers.
Artists upload designs via `artist-service`; `product-service` dynamically
generates SKUs (t-shirts, phone cases, posters, etc.) from those designs;
`order-service` handles customer checkout; and a legacy `monolith-service`
runs on ECS Fargate for admin, back-office, and fulfilment workflows that
haven't yet been decomposed.

The platform is designed for a global audience with primary regions in
**ap-southeast-2 (Sydney, AU)** and **us-east-1 (Virginia, US)**. Route53
latency-based routing steers each customer to the closest region, and an
Aurora Global Database replicates state across regions with < 1s RPO for
cross-region failover.

## Service Map

```mermaid
graph TB
    subgraph Edge["Edge Layer (Cloudflare)"]
        CF[Cloudflare CDN/WAF/DNS<br/>Latency-based routing]
    end

    subgraph EKS["EKS Cluster (per region)"]
        NGINX[NGINX Ingress Controller]

        subgraph Services["Microservices"]
            MW[marketplace-web<br/>Next.js SSR storefront]
            PS[product-service<br/>Catalog, SKU generation]
            OS_SVC[order-service<br/>Checkout, payment, orders<br/>SLO owner: 99.9% availability]
            AS[artist-service<br/>Profiles, design uploads, royalties]
            SS[search-service<br/>Product search + autocomplete]
        end

        subgraph Platform["Platform Components"]
            FL[Flagger<br/>Canary controller]
            KP[Karpenter<br/>Node autoscaler]
            HPA[HPA<br/>Horizontal Pod Autoscaler]
            DD[Datadog Agent<br/>Metrics + APM + logs]
        end
    end

    subgraph ECS["ECS Fargate (Legacy)"]
        MONO[monolith-service<br/>Admin, fulfilment, payouts]
    end

    subgraph Data["Data Stores"]
        PG[(Aurora PostgreSQL<br/>Global Database)]
        DDB[(DynamoDB<br/>order-service idempotency)]
        OS_DB[(OpenSearch<br/>search index)]
        RD[(ElastiCache Redis<br/>sessions + cache)]
        S3[(S3<br/>artist design assets)]
    end

    subgraph Messaging["Event Bus"]
        SNS[SNS Topics]
        SQS[SQS Queues]
    end

    CF --> NGINX
    CF --> MONO
    NGINX --> MW
    NGINX --> PS
    NGINX --> OS_SVC
    NGINX --> AS
    NGINX --> SS

    MW --> PS
    MW --> OS_SVC
    OS_SVC -->|cart validation<br/>circuit-broken| PS
    OS_SVC -->|fulfilment handoff<br/>fire-and-forget| MONO
    PS --> AS
    PS --> SS
    PS --> PG
    OS_SVC --> PG
    OS_SVC --> DDB
    OS_SVC --> RD
    AS --> PG
    AS --> S3
    SS --> OS_DB
    MW --> RD
    MONO --> PG

    AS -->|DesignUploaded| SNS
    SNS --> SQS
    SQS -->|generates SKUs| PS
    SQS -->|indexes products| SS
```

## Multi-Region Topology

```mermaid
graph TB
    subgraph Global["Global Edge"]
        RT[Route53 latency-based routing]
        CF[Cloudflare CDN/WAF]
    end

    subgraph AU["Primary: ap-southeast-2 (Sydney)"]
        AU_ALB[ALB + NGINX Ingress]
        AU_EKS[EKS Cluster<br/>product-service, order-service,<br/>artist-service, search-service,<br/>marketplace-web]
        AU_ECS[ECS Fargate<br/>monolith-service]
        AU_DB[(Aurora PG — primary)]
    end

    subgraph US["Secondary: us-east-1 (Virginia)"]
        US_ALB[ALB + NGINX Ingress]
        US_EKS[EKS Cluster<br/>same services]
        US_ECS[ECS Fargate<br/>monolith-service — read-mostly]
        US_DB[(Aurora PG — replica)]
    end

    RT --> CF
    CF -->|AU customers| AU_ALB
    CF -->|US customers| US_ALB
    AU_ALB --> AU_EKS
    AU_ALB --> AU_ECS
    US_ALB --> US_EKS
    US_ALB --> US_ECS
    AU_EKS --> AU_DB
    AU_ECS --> AU_DB
    US_EKS --> US_DB
    US_ECS --> US_DB
    AU_DB -. cross-region replication RPO < 1s .-> US_DB
```

**Failover model:** If the primary region degrades, a Route53 health check
flips DNS weights to US within ~60s. Aurora Global Database promotes the US
replica to writer (managed failover takes < 2min). Checkout writes go to the
new primary; the order-service uses DynamoDB Global Tables for idempotency
keys, so in-flight duplicate-check state follows customers across regions
without the risk of double-charging during failover.

## Event-Driven Flow: Artist Upload → Product Listing

```mermaid
sequenceDiagram
    participant A as Artist
    participant MW as marketplace-web
    participant AS as artist-service
    participant S3 as S3 Assets
    participant SNS as SNS (DesignUploaded)
    participant SQS as SQS
    participant PS as product-service
    participant SS as search-service
    participant PG as Aurora PG

    A->>MW: Upload design (PNG/SVG)
    MW->>AS: POST /api/v1/designs
    AS->>S3: Store original asset
    AS->>PG: Persist design record
    AS->>SNS: Publish DesignUploaded{design_id, artist_id}
    AS-->>MW: 201 Created

    SNS->>SQS: Fan out (product + search queues)

    SQS->>PS: Consume DesignUploaded
    PS->>S3: Fetch design
    PS->>PS: Generate SKU variants (tee, mug, case...)
    PS->>PG: Persist product + SKU rows
    PS->>SNS: Publish ProductCreated

    SNS->>SQS: Fan out (search queue)
    SQS->>SS: Consume ProductCreated
    SS->>SS: Index in OpenSearch
```

## Data Flow: Customer Checkout

```mermaid
sequenceDiagram
    participant C as Customer
    participant CF as Cloudflare
    participant MW as marketplace-web
    participant PS as product-service
    participant OS as order-service
    participant CB as Circuit Breaker
    participant STRIPE as Stripe
    participant DDB as DynamoDB
    participant PG as Aurora PG
    participant MONO as monolith-service

    C->>CF: Browse products
    CF->>MW: GET /products
    MW->>PS: GET /api/v1/products
    PS-->>MW: product list
    MW-->>C: Rendered page

    C->>MW: Click "Checkout"
    MW->>OS: POST /api/v1/checkout
    OS->>DDB: Reserve idempotency key (conditional put)
    OS->>CB: fetchProduct(id) via circuit breaker
    CB->>PS: GET /api/v1/products/{id}
    PS-->>CB: product + price
    CB-->>OS: validated cart
    OS->>STRIPE: Charge payment
    STRIPE-->>OS: payment_id
    OS->>PG: INSERT order (status=processing)
    OS->>MONO: POST /internal/fulfilment (fire-and-forget, 2s timeout)
    OS-->>MW: 201 {orderId, paymentId, totalCents}
    MW-->>C: Order confirmation

    Note over CB: If product-service degrades,<br/>breaker opens and order-service<br/>readyz returns 503 → k8s stops<br/>routing traffic → checkout fails fast<br/>instead of hanging the user.
```

## Deployment Flow

```mermaid
graph LR
    subgraph CI["CI (GitHub Actions)"]
        PR[Pull Request] --> LINT[Lint]
        PR --> TEST[Unit Tests]
        PR --> SCAN[Trivy + Gitleaks]
        LINT --> BUILD[Build Image]
        TEST --> BUILD
        SCAN --> BUILD
        BUILD --> PUSH[Push to ECR]
    end

    subgraph CD["CD (Buildkite)"]
        PUSH --> STAGE[Deploy to Staging]
        STAGE --> SMOKE[Smoke Tests]
        SMOKE --> GATE[Manual Approval Gate]
        GATE --> CANARY[Deploy Canary 10%]
        CANARY --> MONITOR[Flagger: Monitor<br/>success rate + p99 latency]
        MONITOR -->|Pass x5| PROMOTE[Step +10% traffic]
        PROMOTE --> MONITOR
        PROMOTE -->|50% → 100%| DONE[Full Rollout]
        MONITOR -->|Fail x5| ROLLBACK[Auto-rollback<br/>+ Slack + PagerDuty]
    end
```

## Network Topology (Single Region)

```mermaid
graph TB
    subgraph Internet
        USERS[Users]
        CF[Cloudflare Edge]
    end

    subgraph VPC["AWS VPC (10.0.0.0/16)"]
        subgraph Public["Public Subnets (× 3 AZs)"]
            ALB[ALB → NGINX Ingress]
            NAT[NAT Gateway per AZ]
        end

        subgraph Private["Private Subnets (× 3 AZs)"]
            subgraph EKS_Nodes["EKS Worker Nodes"]
                N1[Node 1<br/>m6i.large]
                N2[Node 2<br/>m6i.large]
                N3[Node 3<br/>m5.large]
            end

            subgraph ECS_Tasks["ECS Fargate Tasks"]
                T1[monolith-service × 2]
            end
        end

        subgraph Data_Subnet["Data Subnets (× 3 AZs)"]
            RDS[(Aurora PostgreSQL<br/>Multi-AZ + Global)]
            EC[(ElastiCache Redis)]
            OSC[(OpenSearch 3-node)]
            DDB2[(DynamoDB<br/>global table)]
        end

        subgraph Endpoints["VPC Endpoints"]
            ECR_EP[ECR]
            S3_EP[S3 Gateway]
            SNS_EP[SNS]
            SQS_EP[SQS]
        end
    end

    USERS --> CF
    CF --> ALB
    ALB --> N1
    ALB --> N2
    ALB --> T1
    N1 --> RDS
    N1 --> EC
    N1 --> DDB2
    N2 --> OSC
    T1 --> RDS
    N1 --> S3_EP
    N1 --> SNS_EP
```

## Infrastructure Components

### Compute

| Component | Type | Purpose | Scaling |
|---|---|---|---|
| EKS Worker Nodes | EC2 (Karpenter-managed) | Microservices hosting | Karpenter auto-provisioning |
| ECS Fargate Tasks | Fargate | `monolith-service` | Application Auto Scaling (CPU target 70%) |
| HPA (product-service) | Kubernetes HPA | Horizontal scaling | CPU 70%, min 3 / max 10 |
| HPA (order-service) | Kubernetes HPA | Horizontal scaling | CPU 60%, min 3 / max 20 |

### Data Stores

| Store | Type | Purpose | HA Configuration |
|---|---|---|---|
| Aurora PostgreSQL | Aurora Global Database | Products, orders, artists, royalties | Multi-AZ + cross-region replica |
| DynamoDB | DynamoDB Global Table | order-service idempotency keys | Global, active-active |
| OpenSearch | Amazon OpenSearch 2.11 | Product search index | 3-node cluster, 1 replica shard |
| Redis | ElastiCache Redis 7 | Sessions, cart state, rate limits | Cluster mode, 2 shards |
| S3 | Standard + Cross-Region Replication | Artist design assets | 99.999999999% durability |

### Networking

| Component | Purpose |
|---|---|
| Cloudflare | CDN, WAF, DNS, DDoS protection, bot management, latency-based routing |
| AWS ALB | Load balancing for EKS ingress and ECS monolith |
| NGINX Ingress | Kubernetes ingress routing, TLS termination |
| Calico | Network policy enforcement (default-deny ingress+egress) |
| VPC Endpoints | Private connectivity to AWS services |
| NAT Gateway | Outbound internet for private subnets (per AZ in prod) |

### Observability

| Tool | Purpose | Data Retention |
|---|---|---|
| Datadog | Metrics, APM, logs, SLOs, dashboards | 30 days (metrics), 15 days (logs) |
| CloudWatch | ECS metrics, VPC flow logs | 90 days |
| Flagger | Canary analysis + automatic rollback | N/A |

### CI/CD

| Tool | Purpose |
|---|---|
| GitHub Actions | CI: lint, test, build, Trivy scan, Gitleaks, ECR push |
| Buildkite | CD: staging deploy, canary deploy, metric-gated promotion, rollback |
| Helm | Kubernetes package management (library chart pattern) |
| Flagger | Progressive delivery controller (metric-driven traffic shifting) |
| ECR | Container image registry (per-region, with replication) |

## SLOs (Service Level Objectives)

| SLO | Target | Owner | Error Budget (30d) |
|---|---|---|---|
| **Checkout Availability** | 99.9% | order-service | 43.2 min |
| **Product Page Latency** | 99% < 300ms | product-service | — |
| **Search Latency** | 95% < 200ms | search-service | — |
| **Order Success Rate** | 99.95% | order-service | 21.6 min (biz SLI) |

See `docs/sla/error-budget-policy.md` for the error budget policy, and
`terraform/modules/datadog/slos.tf` for the authoritative definitions.

## Security Architecture

### Authentication and Authorization

- Cloudflare WAF filters malicious traffic at the edge
- NGINX Ingress handles TLS termination within the cluster
- Service-to-service communication uses internal ClusterIP services (no external exposure)
- API authentication via JWT tokens issued by the auth module
- AWS IAM roles for service accounts (IRSA) for AWS API access
  - `product-service` → S3 read for product images
  - `order-service` → Secrets Manager (Stripe key), DynamoDB (idempotency)
  - `artist-service` → S3 write for design uploads

### Network Security

- Default-deny NetworkPolicies on the `printforge` namespace
- Explicit allow rules per service pair (e.g., order-service → product-service only)
- VPC security groups restrict traffic between subnets
- VPC endpoints for AWS service access (no public internet traversal)
- Cloudflare Origin CA certificates for end-to-end TLS

### Container Security

- Non-root containers enforced via Helm library chart defaults (ADR-004)
- Read-only root filesystem
- Trivy vulnerability scanning in CI pipeline (fails on CRITICAL/HIGH)
- ECR image scanning enabled
- Pod Security Standards enforced (restricted profile)

## Environment Strategy

| Environment | Infrastructure | Purpose | Data |
|---|---|---|---|
| **Production** | EKS + ECS on AWS (AU + US) | Live customer traffic | Real data |
| **Staging** | EKS on AWS (AU only, smaller) | Pre-production validation | Sanitized copy of prod |
| **Development** | Kind cluster (local) | Local development | Seed data |

## Key Design Decisions

For detailed rationale behind architectural choices, see the Architecture Decision Records:

- [ADR-001: Microservices Split](../adr/001-microservices-split.md)
- [ADR-002: EKS for Micro, ECS for Mono](../adr/002-eks-for-micro-ecs-for-mono.md)
- [ADR-003: Flagger Canary Deployments](../adr/003-flagger-canary-deployments.md)
- [ADR-004: Helm Library Chart](../adr/004-helm-library-chart.md)
- [ADR-005: Network Policy Default Deny](../adr/005-network-policy-default-deny.md)
- [ADR-006: SLO-Based Alerting](../adr/006-slo-based-alerting.md)
- [ADR-007: Buildkite for CD, GitHub Actions for CI](../adr/007-buildkite-cd-github-ci.md)
- [ADR-008: Cloudflare Edge Layer](../adr/008-cloudflare-edge-layer.md)
- [ADR-009: Karpenter over Cluster Autoscaler](../adr/009-karpenter-over-cluster-autoscaler.md)
- [ADR-010: Monolith Migration Strategy](../adr/010-monolith-migration-strategy.md)
