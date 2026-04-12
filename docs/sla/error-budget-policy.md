# Error Budget Policy

**Last Updated**: 2024-03-15
**Owner**: SRE Team, Engineering Leadership
**Review Cadence**: Quarterly
**Related ADR**: ADR-006 (SLO-Based Alerting)

## Purpose

This policy defines how PrintForge uses error budgets to balance reliability with feature velocity. Error budgets quantify how much unreliability a service can tolerate before reliability work must take priority over feature development.

## How Error Budgets Work

Each service has a Service Level Objective (SLO) that defines the target reliability over a 30-day rolling window. The error budget is the inverse of the SLO -- the amount of allowed unreliability.

```
Error Budget = 1 - SLO Target

Example: order-service has a 99.9% checkout availability SLO
  Error Budget = 1 - 0.999 = 0.1%
  In a 30-day window: 0.1% * 30 days * 24 hours * 60 minutes = 43.2 minutes of allowed downtime
```

## Service SLOs and Error Budgets

| Service | SLI | SLO | Error Budget (30-day) |
|---|---|---|---|
| order-service | Checkout availability (non-5xx) | 99.9% | 43.2 minutes |
| order-service | Checkout latency (p99 < 400ms) | 99.9% | 43.2 minutes |
| product-service | Availability (non-5xx) | 99.9% | 43.2 minutes |
| product-service | Product page latency (p99 < 300ms) | 99.9% | 43.2 minutes |
| marketplace-web | Availability (non-5xx) | 99.5% | 3.6 hours |
| marketplace-web | TTFB p95 < 800ms | 99.5% | 3.6 hours |
| search-service | Availability (non-5xx) | 99.5% | 3.6 hours |
| search-service | Latency (p99 < 200ms) | 99.5% | 3.6 hours |
| artist-service | Availability (non-5xx) | 99.9% | 43.2 minutes |
| artist-service | Upload success rate | 99.0% | 7.2 hours |

## Budget Consumption Thresholds and Actions

### Green: 0-50% Budget Consumed

**Status**: Normal operations. Feature velocity is unrestricted.

**Indicators**:
- Error budget remaining: > 50%
- Burn rate: < 1x (consuming budget at or below the expected rate)
- Grafana SLO dashboard shows green

**Actions**:
- No restrictions on feature deployments
- Standard canary deployment process applies
- Teams focus on product roadmap
- SRE team monitors dashboards during business hours

**Roles**:
| Role | Responsibility |
|---|---|
| Product teams | Ship features at normal cadence |
| SRE | Monitor SLO dashboards, maintain platform |
| Engineering manager | No action required |

---

### Yellow: 50-75% Budget Consumed

**Status**: Elevated caution. Reliability should be factored into sprint planning.

**Indicators**:
- Error budget remaining: 25-50%
- Burn rate: 1-3x (consuming budget faster than expected)
- Grafana SLO dashboard shows yellow
- Alertmanager: P3/P4 ticket alerts may be firing

**Actions**:
- Feature deployments continue but with increased scrutiny
- Each deployment must be reviewed for reliability risk by the service owner
- At least one reliability improvement item per sprint for the affected service
- SRE team investigates top error contributors and shares findings with the service team
- Weekly error budget review added to team standup

**Roles**:
| Role | Responsibility |
|---|---|
| Product teams | Continue features; add 1 reliability item per sprint |
| SRE | Investigate top error sources, provide recommendations |
| Engineering manager | Ensure reliability items are prioritized |
| Service owner | Review each deploy for reliability risk |

**Example reliability items**:
- Fix the top 3 error-producing endpoints
- Add retry logic for flaky downstream calls
- Increase integration test coverage for failure scenarios
- Tune HPA thresholds to prevent capacity-related errors

---

### Orange: 75-100% Budget Consumed

**Status**: Reliability-first mode. Feature deployments are restricted.

**Indicators**:
- Error budget remaining: 0-25%
- Burn rate: 3-6x (significant budget consumption)
- Grafana SLO dashboard shows orange
- Alertmanager: P2 page alerts may be firing

**Actions**:
- **Feature freeze** for the affected service: only reliability improvements and critical bug fixes are deployed
- Canary deployment analysis thresholds tightened (success rate threshold raised to 99.5%)
- SRE team performs a reliability review of the service
- Daily error budget check-in with the service team and engineering manager
- Postmortem required for any incident that contributed to budget consumption
- On-call engineer monitors deployments in real time

**Roles**:
| Role | Responsibility |
|---|---|
| Product teams | Pause features for affected service; work on reliability |
| SRE | Lead reliability review, pair with service team on fixes |
| Engineering manager | Enforce feature freeze, communicate to stakeholders |
| Service owner | Own the reliability improvement plan |
| Director of Engineering | Aware of the situation; available for escalation |

**Exiting orange status**:
- Error budget must recover above 25% remaining (return to yellow)
- Service team presents a reliability improvement plan before resuming feature work
- SRE team signs off that the improvements address the root causes

---

### Red: 100% Budget Exhausted

**Status**: SLO breached. Emergency reliability mode.

**Indicators**:
- Error budget remaining: 0% (negative budget)
- SLO breached for the rolling 30-day window
- Grafana SLO dashboard shows red
- Alertmanager: P1 critical alerts firing

**Actions**:
- **All deployments halted** for the affected service except reliability fixes
- Emergency reliability review within 24 hours
- Incident declared if not already (see `docs/runbooks/incident-response.md`)
- Engineering leadership notified immediately
- Root cause analysis and remediation plan due within 48 hours
- Remediation items tracked as P1 Jira tickets
- Daily check-ins with engineering leadership until budget begins recovering
- Consider rollback to last known reliable version if budget exhaustion is ongoing

**Roles**:
| Role | Responsibility |
|---|---|
| Product teams | All hands on reliability for affected service |
| SRE | Lead emergency review, coordinate remediation |
| Engineering manager | Escalate to leadership, manage communications |
| Service owner | Own remediation plan, present at review |
| Director of Engineering | Participate in daily check-ins, authorize resource allocation |
| VP of Engineering | Notified, available for cross-team coordination |

**Exiting red status**:
- Error budget must recover above 0% (return to orange)
- Remediation plan completed and validated
- SRE team confirms the root cause is resolved
- Postmortem shared with the engineering organization

## Budget Recovery

Error budgets recover naturally as the 30-day rolling window advances. If a service consumed 100% of its budget due to a 2-hour outage on day 1, the budget fully recovers by day 31 (assuming no further errors).

Recovery can be accelerated by:
- Reducing error rate below the SLO target (budget recovers faster than it depletes)
- Fixing the root causes of errors
- Improving graceful degradation so partial failures do not count as full errors

## Planned Maintenance and Budget Consumption

Planned maintenance (database migrations, infrastructure upgrades) that causes expected errors counts against the error budget. This is intentional -- it forces teams to:

1. Schedule maintenance during low-traffic periods to minimize budget impact
2. Invest in zero-downtime migration techniques
3. Weigh the reliability cost of maintenance against the benefit

If planned maintenance is expected to consume more than 25% of the remaining error budget, it must be approved by the engineering manager and scheduled during the lowest-traffic window (typically Tuesday-Thursday, 2-4 AM UTC).

## Exceptions

The following do not count against error budgets:

- **Dependency outages**: If an AWS service (RDS, S3) experiences a regional outage, errors caused by the outage are excluded from SLO calculations via the `exclude_aws_outage` recording rule
- **Load testing**: Synthetic load test traffic is excluded via the `exclude_synthetic` label
- **Planned failover testing**: Pre-approved chaos engineering experiments are excluded if they are tagged in advance

Exception requests must be filed as a Jira ticket and approved by the SRE lead.

## Quarterly SLO Review

Every quarter, the SRE team and service owners review:

1. **SLO appropriateness**: Are the targets too tight (constant orange/red) or too loose (never challenged)?
2. **Error budget utilization**: What percentage of the budget was consumed? By what causes?
3. **Action effectiveness**: Did the reliability items from yellow/orange phases actually improve the error rate?
4. **SLI accuracy**: Do the SLIs accurately reflect user experience?

Adjustments to SLO targets require approval from the engineering director and are documented as ADR amendments.

## Dashboards and Monitoring

| Dashboard | URL | Purpose |
|---|---|---|
| SLO Overview | `grafana.printforge.io/d/slo-overview` | All services' SLO status and budget remaining |
| Error Budget Burn | `grafana.printforge.io/d/error-budget` | Burn rate trends and forecasts |
| Service Health | `grafana.printforge.io/d/service-health` | Per-service RED metrics |
| Budget History | `grafana.printforge.io/d/budget-history` | 90-day error budget consumption history |

## RACI Matrix

| Activity | SRE | Service Owner | Eng Manager | Director |
|---|---|---|---|---|
| Monitor error budgets | **R** | I | I | - |
| Investigate budget consumption | **R** | A | I | - |
| Enforce feature freeze (orange) | C | R | **A** | I |
| Emergency reliability review (red) | **R** | R | A | **I** |
| Quarterly SLO review | **R** | R | A | **A** |
| Adjust SLO targets | R | C | R | **A** |

R = Responsible, A = Accountable, C = Consulted, I = Informed
