# ADR-010: Strangler Fig Pattern for Monolith Migration

**Status**: Accepted
**Date**: 2024-03-01
**Deciders**: Platform Engineering Team, Engineering Director
**Context Area**: Migration Strategy

## Context

PrintForge's legacy Rails monolith runs on ECS Fargate (see ADR-002) and currently handles approximately 40% of production traffic. The remaining 60% has been migrated to EKS-hosted microservices. The monolith still owns several critical paths:

- Legacy checkout flow (v1 API)
- Artist payout calculations
- Admin dashboard and reporting
- Email notification templates
- Legacy search (being migrated to search-service)

A big-bang migration (rewrite and switch) carries unacceptable risk:

- The monolith has 6 years of business logic with limited test coverage in some modules
- A failed migration could disrupt artist payouts, a contractual obligation
- The checkout flow processes $2M+ monthly; any migration-related outage has direct revenue impact
- The team cannot pause feature development for a multi-month migration project

## Decision

Migrate the monolith to EKS using the **strangler fig pattern**: incrementally route traffic from monolith endpoints to microservice replacements, one domain at a time, until the monolith is empty and can be decommissioned.

### Migration Phases

```
Phase 1: Intercept (Complete)
  - Deploy API gateway (NGINX Ingress) in front of both monolith and microservices
  - Route all traffic through the gateway
  - No behavior change; establishes routing control

Phase 2: Strangle (In Progress)
  - Migrate endpoints domain by domain:
    a. Search endpoints -> search-service     [Complete]
    b. Artist profiles -> artist-service      [Complete]
    c. Catalog reads -> product-service       [In Progress]
    d. Checkout flow -> order-service         [Planned Q3 2024]
    e. Artist payouts -> artist-service       [Planned Q4 2024]
    f. Admin dashboard -> new admin-service   [Planned Q1 2025]

Phase 3: Decommission (Planned Q2 2025)
  - Monolith serves zero production traffic
  - ECS services scaled to zero
  - ECS task definitions archived
  - Final data migration for any remaining monolith-owned tables
```

### Routing Strategy

Traffic routing uses weighted rules at the NGINX Ingress layer:

```yaml
# Example: Migrating /api/v1/products from monolith to product-service
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: products-migration
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "30"  # 30% to new service
spec:
  rules:
    - host: api.printforge.io
      http:
        paths:
          - path: /api/v1/products
            pathType: Prefix
            backend:
              service:
                name: product-service
                port:
                  number: 8080
```

Weight progression for each endpoint migration:

```
Day 1:    5% to microservice (smoke test)
Day 2-3:  25% (monitor error rates and latency)
Day 4-5:  50% (compare response parity)
Day 6-7:  75% (validate under load)
Day 8:    100% (full cutover)
Day 15:   Remove monolith handler (cleanup)
```

### Data Migration Strategy

Each domain migration includes a data ownership transfer:

1. **Dual-write phase**: Microservice writes to its own database; monolith continues writing to legacy database. An event bridge synchronizes changes bidirectionally
2. **Read migration**: Microservice reads from its own database. Legacy database becomes read-only for that domain
3. **Write cutover**: Monolith stops writing to the migrated tables. Event bridge is disabled
4. **Cleanup**: Legacy tables archived after 30-day retention period

### Response Parity Validation

During the dual-traffic phase, a shadow comparison service validates that microservice responses match monolith responses:

- Both backends receive the same request
- Responses are compared for structural equivalence (ignoring timestamps, request IDs)
- Discrepancies are logged to a dedicated Kibana dashboard
- Migration does not proceed past 50% traffic until discrepancy rate is below 0.1%

### Rollback Protocol

Each endpoint migration can be rolled back independently:

1. Set NGINX canary weight to 0% (immediate)
2. Re-enable monolith dual-writes if data migration has started
3. Notify affected teams via Slack
4. File postmortem for root cause analysis

Rollback takes less than 60 seconds for routing changes and less than 5 minutes for data re-synchronization.

## Consequences

### Positive

- **Zero-downtime migration**: Each endpoint migrates independently with gradual traffic shifting. No big-bang cutover risk
- **Continuous feature delivery**: Teams continue shipping features on both monolith and microservices during migration. No feature freeze required
- **Validated correctness**: Response parity checking catches behavioral differences before full cutover
- **Independent rollback**: A failed migration of search endpoints does not affect the checkout flow migration timeline
- **Measurable progress**: Each endpoint migration has clear metrics (traffic percentage, error rate, latency comparison) for go/no-go decisions

### Negative

- **Extended timeline**: The full migration takes 12-18 months. During this period, the team maintains two platforms (ECS and EKS)
- **Dual-write complexity**: Bidirectional data synchronization during migration introduces eventual consistency risks and requires idempotent consumers
- **Cognitive overhead**: Engineers must understand both the monolith codebase and the microservice implementations during the transition
- **Test complexity**: End-to-end tests must cover both routing configurations (monolith-primary and microservice-primary) for migrating endpoints
- **Cost overhead**: Running both platforms concurrently increases infrastructure costs by approximately 20% during the migration period

## Alternatives Considered

### Big-bang rewrite
Freeze the monolith, rewrite all functionality in microservices, switch traffic in a single cutover. Rejected because:
- 6 years of business logic cannot be rewritten without introducing regressions
- Feature development would halt for 6-12 months
- A single cutover has binary outcomes: it works or it does not. No graceful degradation
- Historical industry data shows big-bang rewrites have a high failure rate

### Lift and shift monolith to EKS
Containerize the monolith as-is and run it on EKS. Rejected as insufficient -- this moves the deployment target but does not decompose the monolith. The scaling, ownership, and deploy-coupling problems remain. Lift-and-shift is a step in the migration (the monolith will eventually run on EKS during Phase 3) but not a complete strategy.

### Branch by abstraction
Create abstraction layers within the monolith code, implement new versions behind the abstractions, switch implementations. Rejected because it requires extensive monolith code changes and does not address the operational benefits of independent deployment and scaling that microservices provide.

### Parallel run with automated comparison
Run both systems simultaneously for all traffic, compare responses, and switch when parity is achieved. Rejected because running 100% of traffic through both systems doubles compute costs and introduces latency from the comparison step. Our shadow comparison approach (5-50% traffic) achieves the same validation at lower cost.

## Success Criteria

The migration is considered complete when:

- [ ] Zero production traffic routes to the ECS monolith
- [ ] All legacy database tables are either migrated to service-owned databases or archived
- [ ] ECS task definitions are deregistered
- [ ] Monolith repository is archived (read-only)
- [ ] Cost savings from ECS decommissioning are realized (estimated 15-20% of compute spend)

## References

- Martin Fowler, "Strangler Fig Application" pattern
- Sam Newman, *Monolith to Microservices* -- migration patterns
- ADR-001: Microservices Split (target architecture)
- ADR-002: EKS for Microservices, ECS for Monolith (dual orchestrator context)
