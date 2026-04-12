# ADR-003: Flagger for Progressive Canary Deployments

**Status**: Accepted
**Date**: 2024-02-01
**Deciders**: Platform Engineering Team, SRE Lead
**Context Area**: Deployment Strategy

## Context

PrintForge microservices require a progressive delivery mechanism to reduce the blast radius of bad deployments. A print-on-demand marketplace has low tolerance for checkout failures -- a broken deployment during a product launch can directly impact artist revenue and customer trust.

Requirements for our progressive delivery solution:

1. **Automated canary analysis** -- promote or rollback based on real-time metrics, not manual observation
2. **NGINX Ingress integration** -- our ingress controller is NGINX; the solution must handle traffic splitting natively
3. **Metric-driven decisions** -- integrate with Prometheus for success rate, latency, and error budget metrics
4. **Low CRD complexity** -- the platform team is small; we need a solution the team can operate and debug without deep specialization
5. **Buildkite integration** -- our CD pipeline runs on Buildkite (see ADR-007); the solution must support pipeline-driven promotions

## Decision

Adopt **Flagger** (by Fluxcd) as the progressive delivery controller for all EKS-hosted microservices.

### Canary Configuration

Each service defines a Flagger `Canary` CRD:

```yaml
apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: order-service
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: order-service
  ingressRef:
    apiVersion: networking.k8s.io/v1
    kind: Ingress
    name: order-service
  progressDeadlineSeconds: 600
  analysis:
    interval: 30s
    threshold: 5
    maxWeight: 50
    stepWeight: 10
    metrics:
      - name: request-success-rate
        thresholdRange:
          min: 99
        interval: 30s
      - name: request-duration
        thresholdRange:
          max: 500
        interval: 30s
```

### Deployment Flow

```
1. Developer merges to main
2. GitHub Actions builds image, pushes to ECR, updates Helm values
3. Buildkite CD pipeline applies Helm release to EKS
4. Flagger detects new revision, creates canary deployment
5. Traffic shifts: 0% -> 10% -> 20% -> 30% -> 40% -> 50%
6. At each step, Flagger queries Prometheus:
   - request-success-rate >= 99%
   - p99 latency <= 500ms
7. If metrics pass all steps: promote canary to primary
8. If any step fails: rollback, alert to Slack, mark Buildkite build as failed
```

### Alerting Integration

Flagger sends webhook notifications to:
- **Slack** (#deployments channel) for promotion/rollback events
- **Buildkite** to update pipeline status
- **PagerDuty** for rollback events on tier-1 services (order-service)

## Consequences

### Positive

- **Automated rollback**: Bad deployments are caught and rolled back within 3-5 minutes without human intervention
- **Metric-driven confidence**: Promotions are based on actual production traffic, not hope
- **Native NGINX support**: Flagger manages NGINX ingress annotations for traffic splitting without sidecars or service mesh
- **Simple CRD model**: One Canary resource per service; teams understand the configuration quickly
- **Gradual exposure**: Maximum 50% traffic to canary limits blast radius even if metric collection is delayed

### Negative

- **Analysis window duration**: A full canary rollout takes 5-10 minutes minimum, which is slower than a direct deployment
- **Metric dependency**: If Prometheus is unavailable, Flagger cannot make promotion decisions (mitigated by progress deadline timeout)
- **NGINX limitation**: NGINX ingress traffic splitting is annotation-based and less granular than Istio or Linkerd weighted routing
- **Flagger version coupling**: Flagger releases sometimes lag behind Kubernetes API changes; we pin to stable releases and test upgrades in staging

## Alternatives Considered

### Argo Rollouts
Mature progressive delivery controller with strong Argo ecosystem integration. Rejected for three reasons:

1. **Ingress controller coupling**: Argo Rollouts' NGINX support requires the Argo-specific NGINX plugin, adding a dependency we do not use elsewhere. Flagger works with stock NGINX ingress annotations.
2. **CRD complexity**: Argo Rollouts replaces the Deployment resource with a Rollout CRD, requiring application teams to change their Helm templates. Flagger wraps existing Deployments without modifying them.
3. **Ecosystem fit**: We do not use Argo CD or Argo Workflows. Adopting Argo Rollouts in isolation provides less value than Flagger, which integrates with our existing Flux-based tooling.

### Istio with VirtualService traffic shifting
Use Istio service mesh for fine-grained traffic management. Rejected because Istio introduces sidecar proxies, a control plane, and significant operational complexity. For our current scale (4 services), the overhead is disproportionate to the benefit. If we adopt a service mesh later, Flagger supports Istio as a provider.

### Manual canary via Buildkite pipeline
Implement canary logic in Buildkite pipeline scripts: deploy canary, wait, check metrics via API, promote or rollback. Rejected because it pushes delivery logic into CI/CD scripts, making it harder to audit, version, and standardize across services. Flagger's declarative CRD model is more maintainable.

### Blue-green deployments
Run two full environments and switch traffic atomically. Rejected because it doubles infrastructure cost during deployments and does not provide the gradual traffic shifting that catches issues at low blast radius.

## References

- Flagger documentation: https://docs.flagger.app
- ADR-007: Buildkite for CD, GitHub Actions for CI
- ADR-004: Helm Library Chart (canary CRD included in library)
