# ADR-001: Microservices Split for PrintForge Platform

**Status**: Accepted
**Date**: 2024-01-15
**Deciders**: Platform Engineering Team
**Context Area**: Service Architecture

## Context

PrintForge operates a print-on-demand marketplace connecting artists with customers. The existing monolithic Rails application handles storefront rendering, API endpoints, artist management, and product search within a single deployable unit. As order volume scaled past 50K daily transactions, we observed:

- Deploy cycles exceeding 45 minutes due to full regression test suites
- Search indexing jobs contending with checkout request processing for CPU and memory
- Artist onboarding features blocked by storefront release freezes during peak sales
- Single database connection pool exhaustion during traffic spikes, cascading across unrelated features

The engineering org has grown to four product teams, each owning distinct domains. The monolith's shared codebase creates merge conflicts and unclear ownership boundaries.

## Decision

Decompose the monolith into four bounded services aligned with team ownership and domain boundaries:

| Service | Domain | Team | Primary Data Store |
|---|---|---|---|
| **marketplace-web** | Storefront UI, SSR rendering, cart | Storefront | Redis (sessions), reads from product-service |
| **product-service** | Catalog CRUD, pricing, SKU generation | Platform | PostgreSQL (primary) |
| **order-service** | Orders, checkout, payments | Platform | PostgreSQL (primary) |
| **artist-service** | Artist profiles, uploads, royalty tracking | Creator Tools | PostgreSQL (isolated), S3 |
| **search-service** | Product search, filtering, recommendations | Discovery | OpenSearch |

Service boundaries follow these principles:

1. **Single ownership** -- each service is owned by exactly one team
2. **Independent deployability** -- services deploy on separate cadences without coordination
3. **Data sovereignty** -- each service owns its data store; no shared databases
4. **Synchronous reads, asynchronous writes** -- services expose REST/gRPC for queries; cross-service state changes propagate via SNS/SQS events

## Consequences

### Positive

- **Independent deploy cadences**: Teams ship 3-5x more frequently without cross-team coordination
- **Targeted scaling**: Search-service scales horizontally during traffic spikes without over-provisioning artist-service
- **Fault isolation**: A crash in search-service degrades discovery but does not block checkout
- **Technology flexibility**: Search-service can adopt OpenSearch without forcing schema changes on the order pipeline
- **Clear ownership**: On-call responsibilities map directly to service boundaries

### Negative

- **Operational complexity**: Four services require four CI/CD pipelines, four monitoring dashboards, and distributed tracing
- **Network overhead**: Inter-service calls introduce latency (mitigated by caching and connection pooling)
- **Data consistency**: Eventual consistency between services requires idempotent consumers and compensation logic
- **Testing complexity**: End-to-end tests must coordinate across services; contract testing becomes essential
- **Initial migration cost**: Estimated 2-3 sprint investment to extract each service from the monolith

## Alternatives Considered

### Keep the monolith, modularize internally
Organize code into Rails engines with enforced module boundaries. Rejected because it does not solve independent scaling or deploy isolation, and internal module boundaries tend to erode over time without build-time enforcement.

### Two-service split (frontend/backend)
Separate the rendering layer from all backend logic. Rejected because it leaves the scaling and ownership problems intact on the backend. Artist uploads and search indexing still contend with order processing.

### Full microservices (10+ services)
Decompose further into payments-service, catalog-service, upload-service, recommendations-service, etc. Rejected as premature -- four teams cannot sustain the operational overhead of ten services. We can split further when team count and traffic patterns justify it.

### Domain-Driven Design event sourcing
Model all state as event streams with CQRS read models. Rejected due to the steep learning curve and the existing team's stronger experience with request/response patterns. Event sourcing can be adopted incrementally within individual services later.

## References

- Sam Newman, *Building Microservices* -- bounded context decomposition patterns
- Martin Fowler, "Microservice Prerequisites" -- operational maturity checklist
- Internal traffic analysis showing search and checkout scaling profiles diverge 3:1 during peak events
