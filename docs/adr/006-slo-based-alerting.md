# ADR-006: SLO-Based Alerting over Traditional Threshold Alerting

**Status**: Accepted
**Date**: 2024-02-12
**Deciders**: Platform Engineering Team, SRE Lead
**Context Area**: Observability and Alerting

## Context

PrintForge's initial alerting setup used static threshold alerts:

- CPU > 80% for 5 minutes
- Memory > 85% for 5 minutes
- Error rate > 1% for 2 minutes
- Response latency p99 > 1s for 5 minutes

After three months in production, the on-call team reported:

- **Alert fatigue**: 60% of pages were non-actionable (CPU spikes during batch jobs, transient latency during deployments)
- **Missing context**: An alert for "error rate > 1%" does not communicate how much of the monthly error budget has been consumed or how urgent the response needs to be
- **Inconsistent severity**: A 2% error rate at 3 AM (low traffic) pages with the same urgency as a 2% error rate during peak hours, despite vastly different customer impact
- **No burn rate awareness**: The team could not distinguish between a brief spike that self-recovers and a sustained degradation that will exhaust the error budget

We need an alerting strategy that pages for customer-impacting events, accounts for error budget consumption rate, and reduces noise.

## Decision

Adopt **SLO-based alerting** using error budgets and burn rate windows. Define Service Level Objectives for each service, track error budget consumption, and alert based on the rate at which the budget is being consumed.

### Service Level Objectives

| Service | SLI | SLO Target | Error Budget (30-day) |
|---|---|---|---|
| order-service | Checkout availability (non-5xx) | 99.9% | 43.2 minutes |
| order-service | Checkout p99 latency | < 400ms | 43.2 minutes |
| product-service | Request success rate (non-5xx) | 99.9% | 43.2 minutes |
| product-service | Product page p99 latency | < 300ms | 43.2 minutes |
| marketplace-web | Request success rate | 99.5% | 3.6 hours |
| marketplace-web | Time to first byte p95 | < 800ms | 3.6 hours |
| search-service | Request success rate | 99.5% | 3.6 hours |
| search-service | p99 latency | < 200ms | 3.6 hours |
| artist-service | Request success rate | 99.9% | 43.2 minutes |
| artist-service | Upload success rate | 99.0% | 7.2 hours |

### Burn Rate Alert Windows

Alerts fire based on **burn rate** -- how fast the error budget is being consumed relative to the budget period:

| Alert | Burn Rate | Short Window | Long Window | Severity | Action |
|---|---|---|---|---|---|
| Page (critical) | 14.4x | 5 min | 1 hour | P1 | Immediate response |
| Page (high) | 6x | 30 min | 6 hours | P2 | Respond within 30 min |
| Ticket (warning) | 3x | 2 hours | 3 days | P3 | Investigate next business day |
| Notification | 1x | 6 hours | 3 days | P4 | Awareness, no action required |

### Prometheus Recording Rules

```yaml
# Error budget remaining (0 to 1)
- record: slo:error_budget_remaining:ratio
  expr: |
    1 - (
      sum(rate(http_requests_total{status=~"5.."}[30d]))
      /
      sum(rate(http_requests_total[30d]))
    ) / (1 - 0.999)

# Burn rate over 1 hour
- record: slo:burn_rate:1h
  expr: |
    sum(rate(http_requests_total{status=~"5.."}[1h]))
    /
    sum(rate(http_requests_total[1h]))
    / (1 - 0.999)

# Burn rate over 5 minutes
- record: slo:burn_rate:5m
  expr: |
    sum(rate(http_requests_total{status=~"5.."}[5m]))
    /
    sum(rate(http_requests_total[5m]))
    / (1 - 0.999)
```

### Alert Rules

```yaml
# Critical: Exhausts monthly budget in 2 hours
- alert: SLOBurnRateCritical
  expr: |
    slo:burn_rate:5m{service="order-service"} > 14.4
    and
    slo:burn_rate:1h{service="order-service"} > 14.4
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "order-service burning error budget at 14.4x rate"
    dashboard: "https://grafana.printforge.io/d/slo-overview"
    runbook: "https://docs.printforge.io/runbooks/incident-response"

# Warning: Exhausts monthly budget in 10 days
- alert: SLOBurnRateWarning
  expr: |
    slo:burn_rate:2h{service="order-service"} > 3
    and
    slo:burn_rate:3d{service="order-service"} > 3
  for: 15m
  labels:
    severity: warning
```

### Grafana Dashboard

Each service has an SLO dashboard showing:
- Error budget remaining (percentage and absolute time)
- Burn rate trend (1h, 6h, 24h windows)
- Budget consumption forecast (projected exhaustion date)
- Historical SLO compliance (rolling 30-day)

## Consequences

### Positive

- **Reduced alert noise**: On-call pages decreased by 70% in the first month; remaining pages are actionable
- **Proportional urgency**: A 14.4x burn rate pages immediately; a 1x burn rate creates a ticket. Severity matches customer impact
- **Budget awareness**: Teams see how much error budget remains and can make informed decisions about risky deployments or maintenance windows
- **Business alignment**: SLOs are expressed in terms customers care about (availability, latency), not infrastructure metrics (CPU, memory)
- **Deployment confidence**: Teams can correlate deploy events with budget consumption to assess deployment safety

### Negative

- **Setup complexity**: SLO recording rules and multi-window alert configurations are more complex than simple threshold alerts
- **Metric dependency**: SLO accuracy depends on consistent metric labeling across services. Misconfigured labels create blind spots
- **Cultural shift**: Engineers accustomed to threshold alerts need time to internalize burn rate concepts and error budget accounting
- **Infrastructure alerts still needed**: SLO-based alerting supplements but does not replace node-level alerts (disk full, OOM kills). We maintain a small set of infrastructure threshold alerts alongside SLO alerts

## Alternatives Considered

### Improved threshold alerts with better tuning
Reduce alert noise by adjusting thresholds and adding longer evaluation windows. Rejected because threshold alerts fundamentally lack the context of error budget consumption rate. Better tuning reduces noise temporarily but does not solve the proportional severity problem.

### Anomaly detection (ML-based)
Use machine learning to detect deviations from baseline patterns. Rejected because anomaly detection requires significant historical data, produces false positives during seasonal traffic changes, and is a black box that engineers cannot debug. SLO-based alerting is deterministic and auditable.

### Composite alerts with Alertmanager grouping
Group related threshold alerts into composite notifications to reduce noise. Rejected because grouping addresses notification volume but not the fundamental problem of alerting on infrastructure symptoms instead of customer impact.

### Third-party SLO platforms (Nobl9, Reliably)
Use a managed SLO platform for budget tracking and alerting. Rejected due to cost and the desire to keep observability tooling within the Prometheus/Grafana ecosystem we already operate. The open-source tooling is sufficient for our current scale.

## References

- Google SRE Book, Chapter 5: Service Level Objectives
- Google SRE Workbook, Chapter 5: Alerting on SLOs
- Sloth (SLO generator for Prometheus): https://sloth.dev
- ADR-003: Flagger Canary Deployments (canary metrics feed SLO calculations)
- `docs/sla/error-budget-policy.md` for budget consumption action policies
