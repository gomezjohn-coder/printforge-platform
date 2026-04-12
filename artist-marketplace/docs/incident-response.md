# Incident Response — Black Friday Load Test

## Summary

During Black Friday load testing at 3× baseline (150 VUs), p95 latency on
`order-service` breached the 300ms SLO at approximately the 4-minute mark.
Prometheus alerted via Grafana. Investigation revealed CPU saturation at 85%
on the existing 2 pods. HPA scaled from 2 → 8 pods over 90 seconds. Latency
returned to 180ms p95 within 2 minutes of scale-out completing.

## Timeline

- **T+0:00** — k6 starts ramp to 50 VUs
- **T+2:00** — k6 reaches 150 VUs (3× baseline)
- **T+4:00** — Prometheus fires `OrderServiceP95Breach` alert (p95 = 412ms)
- **T+4:15** — On-call acks alert in PagerDuty
- **T+4:30** — HPA observes CPU > 60% target, begins scaling 2 → 4
- **T+5:00** — HPA continues scale-out to 8 pods
- **T+5:30** — HPA completes; latency begins recovering
- **T+6:00** — p95 back to 180ms; alert auto-resolves

## Root cause

Insufficient baseline replica count for peak traffic. HPA reacted correctly,
but cold-start + image pull on new pods added ~90s of recovery time during
which SLO was breached.

## Remediation

1. Set `hpa.minReplicas: 4` in production `values.yaml`.
2. Added a pre-scaling Buildkite step triggered by a scheduled cron job
   before anticipated traffic events (e.g. flash sales, marketing pushes).
3. Added a burn-rate alert on 1h window to catch degradation earlier.
4. Pre-pulling images via DaemonSet on high-traffic nodes.

## Interview pitch

> I designed and partially implemented a global, multi-region Artist
> Marketplace Platform on AWS, using EKS for microservices and ECS Fargate
> for a simulated legacy monolith — demonstrating multi-orchestrator
> knowledge. Infrastructure is fully defined in Terraform across us-east-1
> and ap-southeast-2, with Route 53 latency-based routing for failover. CI
> runs in GitHub Actions building and pushing to ECR, while Buildkite manages
> Helm-based deployments to staging and production with a manual promotion
> gate. I defined concrete SLOs — 99.9% checkout availability and sub-300ms
> p95 latency — validated them with k6 load tests simulating a 3× Black
> Friday spike, and documented an incident response showing HPA restoring
> performance within two minutes.
