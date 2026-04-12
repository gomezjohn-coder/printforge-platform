# Incident Response Runbook

**Last Updated**: 2026-04-10
**Owner**: SRE Team
**Review Cadence**: Quarterly

## Overview

This runbook defines the incident response procedure for PrintForge production services. It covers detection through postmortem, ensuring consistent, efficient handling of production incidents.

## Severity Levels

| Severity | Definition | Response Time | Examples |
|---|---|---|---|
| **SEV-1** | Complete service outage or data loss risk | 5 minutes | Checkout down, database corruption, security breach |
| **SEV-2** | Major feature degraded, significant user impact | 15 minutes | Search unavailable, payment processing errors > 5% |
| **SEV-3** | Minor feature degraded, limited user impact | 30 minutes | Slow image uploads, intermittent API errors < 1% |
| **SEV-4** | Cosmetic or non-user-facing issue | Next business day | Dashboard rendering glitch, log formatting error |

## Phase 1: Detection

Incidents are detected through:

1. **Automated alerts** (primary): SLO burn rate alerts via Prometheus/Alertmanager to PagerDuty and Slack (#incidents)
2. **Monitoring dashboards**: Grafana SLO dashboards showing error budget consumption
3. **Customer reports**: Support tickets or social media reports escalated by the support team
4. **Internal reports**: Engineers noticing issues during development or testing

### Alert Routing

```
Prometheus -> Alertmanager -> PagerDuty -> On-call engineer (phone + Slack)
                           -> Slack #incidents (all severities)
                           -> Slack #deployments (deploy-related alerts)
```

## Phase 2: Triage (First 10 Minutes)

The on-call engineer performs initial triage:

### Step 1: Acknowledge the alert

```bash
# Acknowledge in PagerDuty (via app or CLI)
# Post in Slack #incidents
```

Slack message template:
```
:rotating_light: INCIDENT DETECTED
Service: [service name]
Severity: [SEV-1/2/3/4]
Alert: [alert name]
Impact: [brief description]
Investigating: @[your name]
```

### Step 2: Assess scope and severity

Check these dashboards in order:

1. **SLO Overview**: `https://grafana.printforge.io/d/slo-overview`
   - Which service SLOs are breached?
   - What is the current burn rate?
   - How much error budget remains?

2. **Service Health**: `https://grafana.printforge.io/d/service-health`
   - Request rate, error rate, latency (RED metrics)
   - Pod status and restarts
   - Recent deployments

3. **Infrastructure**: `https://grafana.printforge.io/d/infrastructure`
   - Node health, CPU, memory
   - Database connections, query latency
   - External dependency status

### Step 3: Check for recent changes

```bash
# Check recent deployments
kubectl -n marketplace get canary
kubectl -n marketplace get events --sort-by='.lastTimestamp' | head -20

# Check recent Helm releases
helm history order-service -n marketplace --max 5

# Check Buildkite for recent deploys
# https://buildkite.com/printforge/order-service/builds
```

### Step 4: Determine if deployment-related

If a deployment occurred in the last 30 minutes:

- Check Flagger canary status: `kubectl -n marketplace get canary order-service -o yaml`
- If canary is in progress, consider rolling back (see `canary-rollback.md`)
- If canary was recently promoted, check metrics before and after promotion

## Phase 3: Mitigation (Reduce Impact)

The goal of mitigation is to reduce user impact as quickly as possible. Fix the root cause later.

### Common Mitigation Actions

**Deployment rollback** (if deploy-related):
```bash
# Rollback to previous Helm release
helm rollback order-service -n marketplace

# Or trigger rollback via Buildkite
# Navigate to last successful build -> "Rebuild"
```

**Scale up** (if capacity-related):
```bash
# Increase HPA minimum replicas
kubectl -n marketplace patch hpa order-service \
  -p '{"spec":{"minReplicas": 10}}'

# Verify pods are scheduling
kubectl -n marketplace get pods -l app=order-service -w
```

**Circuit breaker** (if downstream dependency failure):
```bash
# Check dependent service health
kubectl -n marketplace logs -l app=order-service --tail=100 | grep -i "connection refused\|timeout"

# If search-service is down, order-service should degrade gracefully
# Verify feature flags for graceful degradation
```

**Traffic shedding** (if overwhelming traffic):
```bash
# Adjust Cloudflare rate limiting rules
# Use Cloudflare dashboard or API to tighten rate limits temporarily
```

### Escalation

Escalate if:
- You cannot identify the cause within 15 minutes
- The incident is SEV-1 and requires coordination across teams
- The incident involves data loss or a security breach

Escalation contacts:
- **Platform Lead**: PagerDuty escalation policy (auto after 15 min for SEV-1)
- **Security**: Slack #security-incidents (for security-related incidents)
- **Engineering Director**: Phone (for SEV-1 lasting > 30 minutes)

## Phase 4: Resolution

### Confirm resolution

```bash
# Verify error rates have returned to normal
# Check SLO dashboard for burn rate returning to < 1x

# Verify pods are healthy
kubectl -n marketplace get pods -l app=order-service

# Verify canary is stable (if applicable)
kubectl -n marketplace get canary order-service
```

### Post-resolution checklist

- [ ] Error budget consumption has stopped increasing
- [ ] All pods are in Running state with no restarts
- [ ] Latency has returned to baseline
- [ ] No new error log entries related to the incident
- [ ] Customer-facing status page updated (if it was updated during incident)

### Close the incident

Post in Slack #incidents:
```
:white_check_mark: INCIDENT RESOLVED
Service: [service name]
Duration: [start time] - [end time] ([duration])
Impact: [brief description of user impact]
Resolution: [what fixed it]
Postmortem: [will be scheduled / not needed for SEV-4]
```

## Phase 5: Postmortem

Required for SEV-1 and SEV-2 incidents. Optional for SEV-3. Not required for SEV-4.

### Timeline

- **Within 24 hours**: Incident lead creates postmortem document from template
- **Within 3 business days**: Postmortem review meeting with involved teams
- **Within 5 business days**: Action items assigned and tracked in Jira

### Postmortem Template

```markdown
# Postmortem: [Incident Title]

**Date**: [YYYY-MM-DD]
**Severity**: [SEV-1/2/3/4]
**Duration**: [start] - [end] ([total minutes])
**Incident Lead**: [name]
**Author**: [name]

## Summary
[2-3 sentence summary of the incident and its impact]

## Impact
- Users affected: [number or percentage]
- Revenue impact: [estimated, if applicable]
- Error budget consumed: [percentage of monthly budget]
- SLO breach: [yes/no, which SLOs]

## Timeline (all times UTC)
| Time | Event |
|---|---|
| HH:MM | Alert fired: [alert name] |
| HH:MM | On-call acknowledged |
| HH:MM | [investigation steps] |
| HH:MM | Mitigation applied: [action] |
| HH:MM | Incident resolved |

## Root Cause
[Detailed explanation of what went wrong and why]

## Contributing Factors
- [Factor 1]
- [Factor 2]

## What Went Well
- [Thing 1]
- [Thing 2]

## What Went Poorly
- [Thing 1]
- [Thing 2]

## Action Items
| Action | Owner | Priority | Jira |
|---|---|---|---|
| [Action description] | [name] | P1/P2/P3 | [JIRA-XXX] |

## Lessons Learned
[Key takeaways for the team]
```

### Postmortem Principles

1. **Blameless**: Focus on systems and processes, not individuals. The question is "how did the system allow this?" not "who caused this?"
2. **Thorough**: Include all contributing factors, not just the proximate cause
3. **Actionable**: Every action item has an owner, priority, and tracking ticket
4. **Shared**: Postmortems are shared with the engineering org for collective learning

## On-Call Responsibilities

- **Primary on-call**: First responder for all alerts. Available 24/7 during rotation
- **Secondary on-call**: Backup if primary does not acknowledge within 10 minutes
- **Rotation**: Weekly, Monday to Monday. Handoff includes review of active issues and recent incidents
- **Compensation**: On-call engineers receive on-call stipend per company policy

## Quick Reference: Key Commands

```bash
# Pod status
kubectl -n marketplace get pods -o wide

# Recent events
kubectl -n marketplace get events --sort-by='.lastTimestamp' | head -30

# Pod logs (last 5 minutes)
kubectl -n marketplace logs -l app=order-service --since=5m --tail=200

# Canary status
kubectl -n marketplace get canary

# Node status
kubectl get nodes -o wide

# Helm release history
helm history order-service -n marketplace --max 5

# Restart a deployment
kubectl -n marketplace rollout restart deployment/order-service

# Check HPA
kubectl -n marketplace get hpa
```

## Worked Example: Load Test Checkout Latency Breach

A real incident walkthrough from our Black Friday spike test exercise
(see `monitoring/k6/spike.js`). This is the narrative we use to train new
on-call engineers on the SLO → detection → mitigation loop.

**Situation.** A pre-Black-Friday k6 spike test (3x baseline, 100 → 300 VUs)
ramped up against staging. Within 90 seconds of the ramp, the P99
`http_request_duration_seconds` metric for `order-service` climbed from
~180ms to 900ms and the Checkout Availability burn rate monitor fired.

**Detection.** Datadog raised the `[P2] PrintForge Checkout — P99 Latency > 2s`
monitor followed 90 seconds later by the `[P2] PrintForge — Error Budget
Burn Rate > 2x` monitor. Both paged #platform-alerts with context pointing
at `order-service`.

**Triage.** The on-call engineer checked the Service Overview dashboard and
saw: request rate had tripled (expected), order-service was saturated at
~95% CPU across 3 pods, but the HPA had not yet added pods — the 60-second
stabilisation window meant only one scale-up event had happened. The
circuit breaker to `product-service` was still closed; no 5xx errors were
flowing, only latency degradation.

**Mitigation.** Rather than waiting on HPA reaction time, the engineer
patched the HPA floor:
```bash
kubectl -n printforge patch hpa order-service \
  -p '{"spec":{"minReplicas": 9}}'
```
Within 45 seconds, three new pods were Running and the active k6 spike was
distributed across 9 replicas. P99 latency dropped back to ~220ms, safely
under the 500ms SLO. Checkout availability stayed at 99.98% for the window.

**Root cause.** The HPA was configured with `targetCPUUtilizationPercentage:
60` but the `behavior.scaleUp.maxPods: 4` plus `stabilizationWindowSeconds:
30` combination meant it couldn't react quickly enough to a 3x step function
in traffic. CPU request sizing was also tight — the baseline 3 pods had no
headroom for a burst.

**Fix and follow-up.** Three action items were recorded:
1. Lower `targetCPUUtilizationPercentage` from 60 to 55 for order-service.
2. Raise `behavior.scaleUp.maxPods` from 4 to 6.
3. Add a pre-event warmup step to the runbook: if a forecasted traffic
   spike is expected (sale, campaign, launch), bump `minReplicas` manually
   15 minutes ahead. Don't rely on reactive HPA for announced events.

All three were shipped as a small PR to `helm/charts/order-service/values.yaml`
and validated on the next k6 spike run with the HPA reacting in ~40 seconds
and P99 never exceeding 280ms.

**Takeaway for interviews.** Three-line version of the story: *"During load
testing our P99 checkout latency exceeded the 500ms SLO. Monitoring
identified the bottleneck in `order-service` — HPA was too conservative to
react to the 3x step load. We scaled the pod floor manually to restore the
SLO, then tuned HPA behaviour in Helm so the system handles the same
scenario autonomously."*

