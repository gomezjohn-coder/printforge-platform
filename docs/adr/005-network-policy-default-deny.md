# ADR-005: Default-Deny Network Policies with Explicit Allow Rules

**Status**: Accepted
**Date**: 2024-02-08
**Deciders**: Platform Engineering Team, Security Lead
**Context Area**: Network Security

## Context

PrintForge's EKS cluster hosts four microservices that handle payment data, artist PII, and session tokens. By default, Kubernetes allows unrestricted pod-to-pod communication within a cluster. This means:

- A compromised search-service pod could reach the product-service database port
- A vulnerability in any pod could be used to scan the entire cluster network
- Lateral movement after initial compromise is unconstrained
- PCI DSS compliance requires network segmentation for services handling payment data

We need a network security posture that limits blast radius, enforces least-privilege communication, and provides an auditable record of allowed traffic flows.

## Decision

Implement **default-deny** NetworkPolicies for both ingress and egress on all namespaces, with explicit allow rules for each legitimate traffic flow. Use **Calico** as the CNI plugin to enforce policies, as the default AWS VPC CNI does not support egress NetworkPolicies.

### Default Deny Policy (applied per namespace)

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: marketplace
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
```

### Explicit Allow Rules (example: product-service)

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-product-service
  namespace: marketplace
spec:
  podSelector:
    matchLabels:
      app: product-service
  policyTypes:
    - Ingress
    - Egress
  ingress:
    # Allow traffic from NGINX ingress controller
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
          podSelector:
            matchLabels:
              app.kubernetes.io/name: ingress-nginx
      ports:
        - port: 8080
          protocol: TCP
    # Allow traffic from marketplace-web
    - from:
        - podSelector:
            matchLabels:
              app: marketplace-web
      ports:
        - port: 8080
          protocol: TCP
  egress:
    # Allow DNS resolution
    - to:
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - port: 53
          protocol: UDP
        - port: 53
          protocol: TCP
    # Allow PostgreSQL
    - to:
        - ipBlock:
            cidr: 10.0.10.0/24  # RDS subnet
      ports:
        - port: 5432
          protocol: TCP
    # Allow SNS/SQS via AWS endpoints
    - to:
        - ipBlock:
            cidr: 10.0.20.0/24  # VPC endpoint subnet
      ports:
        - port: 443
          protocol: TCP
```

### Traffic Flow Matrix

| Source | Destination | Port | Purpose |
|---|---|---|---|
| ingress-nginx | marketplace-web | 8080 | External HTTP traffic |
| ingress-nginx | product-service | 8080 | External API traffic |
| marketplace-web | product-service | 8080 | BFF calls |
| product-service | artist-service | 8080 | Artist data lookups |
| product-service | search-service | 8080 | Search queries |
| product-service | RDS subnet | 5432 | Database queries |
| artist-service | S3 VPC endpoint | 443 | Asset uploads |
| search-service | OpenSearch | 9200 | Index queries |
| All services | kube-dns | 53 | DNS resolution |
| All services | VPC endpoints | 443 | AWS API calls |

### Integration with Helm Library Chart

The default-deny policy and service-specific allow rules are templated in the shared Helm library chart (see ADR-004). Services declare their allowed traffic flows in `values.yaml`:

```yaml
networkPolicy:
  ingress:
    - from:
        app: marketplace-web
      port: 8080
  egress:
    - to:
        cidr: 10.0.10.0/24
      port: 5432
```

## Consequences

### Positive

- **Blast radius containment**: A compromised pod can only reach explicitly allowed destinations, limiting lateral movement
- **Auditable traffic flows**: NetworkPolicy manifests serve as living documentation of allowed communication paths
- **Compliance alignment**: Default-deny posture satisfies PCI DSS network segmentation requirements for payment-handling services
- **Defense in depth**: Network policies complement application-level authentication (mTLS, API keys) with infrastructure-level enforcement

### Negative

- **Debugging complexity**: New services or traffic flows fail silently until the correct NetworkPolicy is applied. Engineers must check policies when troubleshooting connectivity
- **DNS dependency**: Forgetting to allow DNS egress (port 53) causes all service communication to fail -- a common gotcha during onboarding
- **CNI requirement**: Calico must be installed and healthy for policies to be enforced. A Calico failure could either block all traffic (fail-closed) or allow all traffic (fail-open) depending on configuration
- **Maintenance overhead**: Each new inter-service communication path requires a policy update, adding a step to the development workflow

## Alternatives Considered

### Allow-all with monitoring only
Rely on network monitoring and IDS to detect unauthorized traffic without enforcing policies. Rejected because detection without prevention does not satisfy compliance requirements and allows lateral movement during the detection window.

### AWS Security Groups only
Use security groups on EKS node groups to control traffic at the EC2 level. Rejected because security groups operate at the node level, not the pod level. Two pods on the same node cannot be isolated by security groups alone.

### Service mesh mTLS (Istio/Linkerd)
Use a service mesh for mutual TLS and authorization policies. Rejected as disproportionate to current needs -- mTLS adds sidecar overhead to every pod. NetworkPolicies provide sufficient isolation at L3/L4 without the complexity of a service mesh. We can layer mTLS on top later if requirements evolve.

### Namespace isolation only
Isolate services by namespace without pod-level policies. Rejected because multiple pods within the same namespace (e.g., a web server and a background worker) need different access rules. Namespace-level isolation is too coarse.

## References

- Kubernetes Network Policies documentation
- Calico documentation: Network Policy ordering and enforcement
- PCI DSS v4.0 Requirement 1: Network Security Controls
- ADR-004: Helm Library Chart (network policy templates)
