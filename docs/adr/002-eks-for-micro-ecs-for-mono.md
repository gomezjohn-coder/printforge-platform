# ADR-002: EKS for Microservices, ECS Fargate for Legacy Monolith

**Status**: Accepted
**Date**: 2024-01-22
**Deciders**: Platform Engineering Team, SRE Lead
**Context Area**: Container Orchestration

## Context

PrintForge is migrating from a monolithic architecture to microservices (see ADR-001). During the transition period, the legacy Rails monolith and the new microservices must run concurrently in production. We need a container orchestration strategy that:

1. Supports the operational patterns microservices require (service mesh, progressive delivery, network policies)
2. Keeps the legacy monolith running with minimal operational investment while it is being decomposed
3. Provides a clear migration path so the monolith eventually moves to the same platform
4. Stays within the operational capacity of a small platform engineering team (3 engineers)

The monolith currently runs on ECS Fargate and has been stable there for 18 months. Replatforming it to Kubernetes immediately would delay the microservices work by an estimated 4-6 weeks and introduce risk to a system that is functioning correctly.

## Decision

Run a **dual orchestrator** strategy:

- **Amazon EKS** (Kubernetes 1.29) for all new microservices: marketplace-web, product-service, artist-service, search-service
- **Amazon ECS Fargate** for the legacy monolith until it is fully decomposed

### EKS Configuration

- Managed node groups with Karpenter for autoscaling (see ADR-009)
- NGINX Ingress Controller for traffic routing
- Flagger for progressive delivery (see ADR-003)
- Calico for network policies (see ADR-005)
- Helm-based deployments via shared library chart (see ADR-004)

### ECS Fargate Configuration

- Existing task definitions and service configurations preserved
- ALB target group routing for monolith endpoints
- CloudWatch-based monitoring (no change from current)
- Gradual traffic migration via weighted ALB routing rules as endpoints move to microservices

### Cross-Platform Communication

- Monolith and microservices communicate via internal ALB and AWS PrivateLink
- Shared VPC with peered subnets ensures low-latency connectivity
- SNS/SQS event bus for asynchronous cross-platform communication

## Consequences

### Positive

- **Zero monolith risk**: The monolith continues running on proven infrastructure while microservices mature
- **Right tool for the job**: EKS provides the Kubernetes ecosystem (Helm, Flagger, network policies) that microservices need; ECS provides the simplicity the monolith needs
- **Incremental migration**: Endpoints migrate individually from monolith to microservices without a big-bang cutover
- **Team focus**: Platform engineers invest learning time in Kubernetes for the future architecture rather than maintaining two systems at full depth
- **Cost efficiency**: ECS Fargate for the monolith avoids paying for Kubernetes control plane costs on a workload that does not benefit from them

### Negative

- **Two operational surfaces**: On-call engineers must understand both EKS and ECS debugging workflows during the transition period
- **Networking complexity**: Cross-platform service discovery requires ALB-based routing rather than native Kubernetes service DNS
- **Monitoring fragmentation**: EKS uses Prometheus/Grafana; ECS uses CloudWatch. Dashboards must be consolidated (Grafana CloudWatch data source mitigates this)
- **Temporary state**: The dual-orchestrator setup is explicitly temporary, but "temporary" infrastructure tends to persist. The migration timeline must be actively managed

## Migration Path

The monolith migration follows the strangler fig pattern (see ADR-010):

```
Phase 1 (Current): Monolith on ECS, microservices on EKS
Phase 2 (Q3 2024): 60% of traffic served by EKS microservices
Phase 3 (Q1 2025): Monolith containerized for K8s, running on EKS
Phase 4 (Q2 2025): ECS decommissioned
```

Each phase has a go/no-go checkpoint based on error budget consumption and latency SLOs.

## Alternatives Considered

### EKS for everything from day one
Migrate the monolith to EKS immediately alongside the new microservices. Rejected because the monolith has no Helm charts, health check endpoints need refactoring, and the migration would delay microservices delivery by 4-6 weeks. The risk of destabilizing a working production system during the busiest sales quarter was unacceptable.

### ECS for everything
Run microservices on ECS Fargate alongside the monolith. Rejected because ECS lacks native support for progressive delivery (Flagger), network policies (Calico), and the Helm ecosystem. Building these capabilities on ECS would require significant custom tooling.

### AWS App Runner
Use App Runner for simpler services and ECS for the monolith. Rejected due to limited networking controls, no VPC integration at the time of evaluation, and insufficient observability hooks.

### Nomad
Use HashiCorp Nomad as a lighter-weight orchestrator. Rejected because the team has Kubernetes experience, the ecosystem tooling (Helm, Flagger, Karpenter) is more mature, and Kubernetes skills are more transferable for hiring.

## References

- AWS Well-Architected Framework -- Container Orchestration pillar
- ADR-001: Microservices Split
- ADR-009: Karpenter over Cluster Autoscaler
- ADR-010: Monolith Migration Strategy
