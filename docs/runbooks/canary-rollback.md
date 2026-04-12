# Canary Deployment Rollback Runbook

**Last Updated**: 2024-03-15
**Owner**: Platform Engineering Team
**Related ADR**: ADR-003 (Flagger Canary Deployments)

## Overview

This runbook covers handling canary deployment failures for PrintForge microservices on EKS. Flagger manages progressive delivery with automated rollback, but manual intervention may be needed when automation fails or when a promoted release causes issues.

## How Canary Deployments Work

```
New image pushed -> Flagger creates canary pods
                 -> Traffic shifts: 10% -> 20% -> 30% -> 40% -> 50%
                 -> At each step: check success rate >= 99%, p99 < 500ms
                 -> All checks pass: promote (canary becomes primary)
                 -> Any check fails 5 times: rollback (canary terminated)
```

## Scenario 1: Automatic Rollback (Flagger Handles It)

Flagger automatically rolls back when canary metrics fail the analysis threshold.

### Detection

You will see:
- Slack notification in #deployments: "Canary [service] has been rolled back"
- Buildkite build marked as failed
- Flagger canary status shows `Failed`

### Verification

```bash
# Check canary status
kubectl -n marketplace get canary order-service

# Expected output for a rolled-back canary:
# NAME              STATUS   WEIGHT   LASTTRANSITIONTIME
# order-service   Failed   0        2024-03-15T10:30:00Z

# Check Flagger events for details
kubectl -n marketplace describe canary order-service
# Look for "Events" section -- it will show which metric failed

# Verify primary deployment is healthy
kubectl -n marketplace get pods -l app=order-service
# All pods should be Running with no recent restarts
```

### Response

1. **No immediate action required** -- Flagger has already restored the previous version
2. **Investigate the failure**:

```bash
# Check canary pod logs (if pods still exist)
kubectl -n marketplace logs -l app=order-service-canary --tail=200

# Check Prometheus for the failed metric
# Navigate to: https://grafana.printforge.io/d/canary-analysis
# Filter by service and time window of the canary attempt

# Check the image that was deployed
kubectl -n marketplace get canary order-service -o jsonpath='{.status.lastAppliedSpec}'
```

3. **Fix the issue** in the service code, merge, and let CI/CD create a new canary attempt
4. **If the failure was a false positive** (e.g., Prometheus was temporarily unavailable):

```bash
# Reset the canary to allow a retry with the same image
kubectl -n marketplace annotate canary order-service \
  flagger.app/revision="" --overwrite
```

## Scenario 2: Manual Rollback (Post-Promotion Issues)

A canary was promoted (metrics looked good during analysis) but problems appear after full traffic shift.

### Detection

- SLO burn rate alert fires after canary promotion
- Customer reports of errors or degraded experience
- Error rate increase visible in Grafana dashboards

### Immediate Rollback via Helm

```bash
# List recent Helm releases
helm history order-service -n marketplace --max 5

# Output:
# REVISION  STATUS      CHART                  APP VERSION  DESCRIPTION
# 42        superseded  order-service-1.2.3  abc1234      Upgrade complete
# 43        deployed    order-service-1.2.4  def5678      Upgrade complete

# Rollback to the previous revision
helm rollback order-service 42 -n marketplace

# Verify the rollback
kubectl -n marketplace rollout status deployment/order-service

# Confirm pods are running the previous image
kubectl -n marketplace get pods -l app=order-service \
  -o jsonpath='{.items[0].spec.containers[0].image}'
```

### Rollback via Buildkite

If you prefer a pipeline-driven rollback:

1. Navigate to the Buildkite dashboard: `https://buildkite.com/printforge/order-service/builds`
2. Find the last successful build (before the problematic deployment)
3. Click "Rebuild" to re-deploy the known-good version
4. Monitor the new canary deployment in Flagger

### Rollback via Git Revert

For code-level rollback that goes through the full CI/CD pipeline:

```bash
# Revert the problematic commit
git revert <commit-sha>
git push origin main

# This triggers:
# 1. GitHub Actions CI (lint, test, build, push)
# 2. Buildkite CD (deploy with canary)
# The reverted code deploys through the normal canary process
```

## Scenario 3: Stuck Canary

The canary is neither progressing nor rolling back -- it is stuck at a traffic weight.

### Detection

```bash
kubectl -n marketplace get canary order-service
# STATUS shows "Progressing" but WEIGHT has not changed for > 15 minutes
```

### Diagnosis

```bash
# Check Flagger controller logs
kubectl -n flagger-system logs -l app.kubernetes.io/name=flagger --tail=100

# Common causes:
# 1. Prometheus is unreachable (Flagger cannot query metrics)
# 2. Metric query returns no data (misconfigured metric template)
# 3. Flagger controller is crashlooping

# Check Prometheus connectivity
kubectl -n monitoring port-forward svc/prometheus-server 9090:80 &
curl -s localhost:9090/api/v1/query?query=up | jq '.status'
```

### Resolution

```bash
# Option 1: Force promotion (if you are confident the canary is healthy)
kubectl -n marketplace annotate canary order-service \
  flagger.app/force-promote="true"

# Option 2: Force rollback (if you want to abort)
kubectl -n marketplace annotate canary order-service \
  flagger.app/force-rollback="true"

# Option 3: Restart Flagger controller (if controller is unhealthy)
kubectl -n flagger-system rollout restart deployment/flagger
```

### After Resolving a Stuck Canary

1. Verify Prometheus is healthy and scraping metrics
2. Check Flagger's metric templates are correctly configured
3. Test the canary pipeline in staging before the next production deployment

## Scenario 4: Canary Causing Downstream Failures

The canary pods are healthy and passing metrics, but they are causing errors in downstream services.

### Detection

- Downstream service (e.g., artist-service) shows increased error rate
- Errors correlate with canary traffic weight changes
- Canary metrics for the deploying service look healthy

### Response

```bash
# Immediately halt canary progression
kubectl -n marketplace annotate canary order-service \
  flagger.app/force-rollback="true"

# Check downstream service logs for errors from canary pods
kubectl -n marketplace logs -l app=artist-service --tail=200 | grep -i error

# Identify the canary pod IPs
kubectl -n marketplace get pods -l app=order-service-canary -o wide
# Cross-reference with downstream error logs
```

## Monitoring During Canary Deployments

### Key Dashboards

| Dashboard | URL | What to Watch |
|---|---|---|
| Canary Analysis | `grafana.printforge.io/d/canary-analysis` | Per-step metric results |
| SLO Overview | `grafana.printforge.io/d/slo-overview` | Error budget consumption |
| Service Health | `grafana.printforge.io/d/service-health` | RED metrics for all services |

### Key Metrics to Watch

```promql
# Canary vs primary success rate
sum(rate(http_requests_total{status!~"5..",deployment="order-service-canary"}[1m]))
/
sum(rate(http_requests_total{deployment="order-service-canary"}[1m]))

# Canary latency
histogram_quantile(0.99,
  sum(rate(http_request_duration_seconds_bucket{deployment="order-service-canary"}[1m]))
  by (le)
)

# Error budget burn rate during canary
slo:burn_rate:5m{service="order-service"}
```

## Post-Rollback Checklist

- [ ] Verify primary deployment is serving 100% of traffic
- [ ] Confirm error rates have returned to baseline
- [ ] Check SLO dashboard for error budget impact
- [ ] Notify the team in Slack #deployments with rollback details
- [ ] Create a Jira ticket for investigating the root cause
- [ ] If SEV-1/SEV-2 impact occurred, initiate incident response (see `incident-response.md`)

## Quick Reference: Flagger Commands

```bash
# View canary status
kubectl -n marketplace get canary

# Describe canary (shows events and analysis results)
kubectl -n marketplace describe canary order-service

# Force promote canary to primary
kubectl -n marketplace annotate canary order-service flagger.app/force-promote="true"

# Force rollback canary
kubectl -n marketplace annotate canary order-service flagger.app/force-rollback="true"

# Suspend canary (pause analysis)
kubectl -n marketplace annotate canary order-service flagger.app/suspend="true"

# Resume canary
kubectl -n marketplace annotate canary order-service flagger.app/suspend="false"

# Check Flagger controller logs
kubectl -n flagger-system logs -l app.kubernetes.io/name=flagger --tail=100
```
