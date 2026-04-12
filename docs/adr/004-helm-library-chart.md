# ADR-004: Shared Helm Library Chart for DRY Service Definitions

**Status**: Accepted
**Date**: 2024-02-05
**Deciders**: Platform Engineering Team
**Context Area**: Configuration Management

## Context

PrintForge runs four microservices on EKS (see ADR-001), each requiring a similar set of Kubernetes resources:

- Deployment with standard pod spec (probes, resource limits, security context)
- Service and Ingress with NGINX annotations
- HPA with target CPU/memory thresholds
- Flagger Canary CRD (see ADR-003)
- NetworkPolicy with default-deny and explicit allow rules (see ADR-005)
- ServiceMonitor for Prometheus scraping
- ConfigMap and Secret references

Without a shared pattern, each service team maintains their own copy of these templates. Over six months, we observed:

- **Template drift**: product-service had readiness probe timeout of 5s while artist-service used 3s, with no documented reason for the difference
- **Missed security updates**: When we added `runAsNonRoot: true` to security contexts, two services were missed because each chart was updated independently
- **Onboarding friction**: New services required copying and modifying 8-12 template files, a process that took 2-3 hours and was error-prone

## Decision

Create a **Helm library chart** (`printforge-library`) that defines reusable template helpers for all standard Kubernetes resources. Service charts declare the library as a dependency and override only the values specific to their domain.

### Library Chart Structure

```
charts/printforge-library/
  Chart.yaml          # type: library
  templates/
    _deployment.tpl   # Standard deployment with probes, security context
    _service.tpl      # ClusterIP service
    _ingress.tpl      # NGINX ingress with TLS, rate limiting annotations
    _hpa.tpl          # HorizontalPodAutoscaler
    _canary.tpl       # Flagger Canary CRD
    _netpol.tpl       # NetworkPolicy default-deny + allow rules
    _servicemonitor.tpl  # Prometheus ServiceMonitor
    _helpers.tpl      # Label selectors, naming conventions
  values.yaml         # Sensible defaults
```

### Service Chart Usage

A service chart (e.g., `charts/product-service/`) contains:

```yaml
# Chart.yaml
dependencies:
  - name: printforge-library
    version: "1.x.x"
    repository: "file://../printforge-library"
```

```yaml
# values.yaml (only service-specific overrides)
nameOverride: product-service
image:
  repository: 123456789.dkr.ecr.us-west-2.amazonaws.com/product-service
  tag: "latest"
replicaCount: 3
resources:
  requests:
    cpu: 250m
    memory: 512Mi
  limits:
    cpu: 500m
    memory: 1Gi
ingress:
  host: api.printforge.io
  path: /
env:
  DATABASE_URL:
    secretKeyRef:
      name: product-service-db
      key: url
```

### Enforced Defaults

The library chart enforces platform standards through defaults that services inherit unless explicitly overridden:

| Setting | Default | Rationale |
|---|---|---|
| `securityContext.runAsNonRoot` | `true` | Container security baseline |
| `securityContext.readOnlyRootFilesystem` | `true` | Prevent runtime filesystem writes |
| `readinessProbe.initialDelaySeconds` | `5` | Consistent health check timing |
| `readinessProbe.periodSeconds` | `10` | Balanced between responsiveness and load |
| `resources.requests.cpu` | `100m` | Minimum reservation for scheduling |
| `networkPolicy.defaultDeny` | `true` | Zero-trust network posture |
| `hpa.minReplicas` | `2` | Availability during node failures |
| `canary.analysis.threshold` | `5` | Failed checks before rollback |

### Versioning Strategy

- Library chart follows semver: breaking template changes bump major, new templates bump minor, bug fixes bump patch
- Service charts pin to major version (`1.x.x`) to receive non-breaking improvements automatically
- Breaking changes require coordinated updates across service charts with a migration guide in the changelog

## Consequences

### Positive

- **Consistency**: All services inherit the same security context, probe configuration, and network policies from a single source
- **Fast onboarding**: Adding a new service requires a 20-line `values.yaml` instead of copying 12 template files (see `docs/onboarding/adding-a-new-service.md`)
- **Centralized updates**: Security patches, annotation changes, and policy updates apply to all services by bumping the library version
- **Reduced review burden**: Reviewers focus on service-specific values rather than auditing boilerplate templates

### Negative

- **Abstraction cost**: Debugging template rendering requires understanding the library's `_*.tpl` helper functions
- **Override complexity**: Services with non-standard requirements (e.g., StatefulSet instead of Deployment) may fight the library's assumptions
- **Version coordination**: Major version bumps require updating all service charts, creating a brief coordination window
- **Learning curve**: Engineers must understand Helm's `include` and `tpl` functions to contribute to the library

## Alternatives Considered

### Copy-paste with linting
Each service maintains its own templates; a CI lint job enforces standards via conftest/OPA policies. Rejected because policy enforcement is reactive (catches violations at PR time) rather than proactive (prevents them by default). It also does not solve the onboarding friction problem.

### Kustomize overlays
Use Kustomize bases and overlays instead of Helm. Rejected because our existing tooling (Flagger, Buildkite pipelines) integrates with Helm releases. Kustomize's patch-based model also becomes unwieldy when the base templates are complex.

### Jsonnet/Tanka
Use data-templating languages for more expressive configuration. Rejected because the team has existing Helm expertise, and introducing a new templating language adds cognitive load without proportional benefit at our current scale.

### Helmfile
Use Helmfile to manage multiple Helm releases declaratively. Helmfile is complementary to (not a replacement for) a library chart. We may adopt Helmfile for release orchestration in the future, but it does not solve template duplication.

## References

- Helm documentation: Library Charts
- ADR-001: Microservices Split
- ADR-003: Flagger Canary Deployments
- ADR-005: Network Policy Default Deny
