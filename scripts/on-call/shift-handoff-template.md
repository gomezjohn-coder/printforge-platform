# PrintForge On-Call Shift Handoff

**Date:** YYYY-MM-DD
**Outgoing:** [Name] (Melbourne, AEST/AEDT)
**Incoming:** [Name] (New York, EST/EDT)

---

## Current Incident Status

| ID | Severity | Service | Summary | Status | Owner |
|----|----------|---------|---------|--------|-------|
| - | - | - | No active incidents | - | - |

## Active Alerts

List any monitors currently in alert or warning state:

- [ ] None at time of handoff

## Recent Deployments (Last 24h)

| Time (UTC) | Service | Version | Status | Notes |
|------------|---------|---------|--------|-------|
| - | - | - | - | - |

## Canary Deployments In Progress

- [ ] No active canaries

## Pending Action Items

Items that need attention during the incoming shift:

- [ ] None

## Error Budget Status

| SLO | Target | Current | Budget Remaining | Status |
|-----|--------|---------|-----------------|--------|
| API Availability | 99.9% | - | - | OK |
| API Latency P99 | <500ms | - | - | OK |
| Search Latency | <200ms | - | - | OK |
| Order Success | 99.95% | - | - | OK |

## Infrastructure Notes

Any cluster, node, or infrastructure concerns:

- [ ] All nodes healthy
- [ ] No pending cluster upgrades
- [ ] Certificate renewals: none due

## Scheduled Maintenance

| Date/Time (UTC) | Description | Impact | Owner |
|-----------------|-------------|--------|-------|
| - | None scheduled | - | - |

## Chaos Experiments

Any planned or recently run chaos experiments:

- [ ] None planned

## Handoff Checklist

**Outgoing SRE:**
- [ ] Reviewed all active monitors and alerts
- [ ] Documented any ongoing investigations
- [ ] Updated this handoff document
- [ ] Verified PagerDuty schedule shows correct incoming SRE
- [ ] Confirmed dashboard access for incoming SRE

**Incoming SRE:**
- [ ] Read and acknowledged this handoff
- [ ] Verified PagerDuty notifications are working
- [ ] Reviewed dashboards: service-overview, kubernetes-cluster
- [ ] Confirmed VPN/cluster access
- [ ] Checked Slack channels: #printforge-alerts, #printforge-incidents

---

**Handoff Time (UTC):** HH:MM
**Handoff Method:** Slack call / Video / Async
