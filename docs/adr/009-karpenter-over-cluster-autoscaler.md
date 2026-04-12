# ADR-009: Karpenter over Cluster Autoscaler for EKS Node Scaling

**Status**: Accepted
**Date**: 2024-02-25
**Deciders**: Platform Engineering Team, SRE Lead
**Context Area**: Compute Infrastructure, Autoscaling

## Context

PrintForge's EKS cluster experiences significant traffic variability:

- **Weekday pattern**: Baseline of 4 nodes, scaling to 8-10 during business hours
- **Product launch spikes**: Artist product launches can double traffic within 15 minutes
- **Seasonal peaks**: Holiday shopping seasons sustain 3-4x baseline for weeks

Cluster Autoscaler (CAS) has been managing node scaling but presents several pain points:

- **Slow provisioning**: CAS works through Auto Scaling Groups (ASGs), which require pre-configured launch templates. Scaling from 4 to 10 nodes takes 5-8 minutes as CAS waits for ASG capacity
- **Instance type rigidity**: Each ASG is tied to specific instance types. When c5.xlarge capacity is exhausted in the AZ, CAS cannot fall back to c5a.xlarge or m5.xlarge without a separate ASG
- **Poor bin-packing**: CAS scales node groups, not individual nodes. It often provisions a full node for a pod that needs 200m CPU, wasting 75% of the node's capacity
- **Configuration sprawl**: Supporting multiple instance types requires multiple ASGs, each with its own launch template, scaling policies, and Terraform configuration

## Decision

Replace Cluster Autoscaler with **Karpenter** (v0.33+) for all EKS node provisioning.

### NodePool Configuration

```yaml
apiVersion: karpenter.sh/v1beta1
kind: NodePool
metadata:
  name: default
spec:
  template:
    spec:
      requirements:
        - key: kubernetes.io/arch
          operator: In
          values: ["amd64"]
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["on-demand", "spot"]
        - key: karpenter.k8s.aws/instance-category
          operator: In
          values: ["c", "m", "r"]
        - key: karpenter.k8s.aws/instance-generation
          operator: Gt
          values: ["4"]
        - key: karpenter.k8s.aws/instance-size
          operator: In
          values: ["medium", "large", "xlarge", "2xlarge"]
      nodeClassRef:
        name: default
  limits:
    cpu: "160"
    memory: 640Gi
  disruption:
    consolidationPolicy: WhenUnderutilized
    expireAfter: 720h  # 30 days, force node rotation
```

### EC2NodeClass Configuration

```yaml
apiVersion: karpenter.k8s.aws/v1beta1
kind: EC2NodeClass
metadata:
  name: default
spec:
  amiFamily: AL2
  subnetSelectorTerms:
    - tags:
        karpenter.sh/discovery: printforge-eks
  securityGroupSelectorTerms:
    - tags:
        karpenter.sh/discovery: printforge-eks
  instanceProfile: KarpenterNodeInstanceProfile
  blockDeviceMappings:
    - deviceName: /dev/xvda
      ebs:
        volumeSize: 100Gi
        volumeType: gp3
        encrypted: true
  tags:
    team: platform
    managed-by: karpenter
```

### Workload-Specific NodePools

```yaml
# High-memory pool for search-service (OpenSearch client)
apiVersion: karpenter.sh/v1beta1
kind: NodePool
metadata:
  name: memory-optimized
spec:
  template:
    spec:
      requirements:
        - key: karpenter.k8s.aws/instance-category
          operator: In
          values: ["r"]
        - key: karpenter.k8s.aws/instance-size
          operator: In
          values: ["xlarge", "2xlarge"]
      taints:
        - key: workload-type
          value: memory-intensive
          effect: NoSchedule
  limits:
    cpu: "32"
    memory: 256Gi
```

### Spot Instance Strategy

- Baseline workloads (product-service, marketplace-web): On-demand only for reliability
- Batch processing and non-critical workers: Spot instances with Karpenter's automatic fallback to on-demand when spot capacity is unavailable
- Karpenter automatically diversifies across instance types to reduce spot interruption risk

## Consequences

### Positive

- **Faster provisioning**: Karpenter provisions nodes in 60-90 seconds by calling the EC2 Fleet API directly, bypassing ASG delays. This is 3-5x faster than CAS
- **Better bin-packing**: Karpenter selects the smallest instance type that fits pending pods, reducing waste. Observed 30% reduction in node count for the same workload
- **Instance flexibility**: Karpenter automatically selects from any instance type matching the NodePool requirements. When c5.xlarge is unavailable, it provisions c5a.xlarge or m5.xlarge without manual intervention
- **Automatic consolidation**: Karpenter's consolidation policy detects underutilized nodes and reschedules pods to fewer, better-utilized nodes during off-peak hours
- **Simplified configuration**: One NodePool replaces 4 ASGs with their launch templates and scaling policies. Total Terraform configuration reduced by approximately 200 lines
- **Node rotation**: `expireAfter` ensures nodes are replaced every 30 days, picking up the latest AMIs and preventing configuration drift

### Negative

- **AWS-specific**: Karpenter is tightly coupled to AWS. A future multi-cloud strategy would require a different autoscaler
- **Disruption risk**: Karpenter's consolidation can reschedule pods aggressively. Pod disruption budgets must be configured correctly to prevent service disruption during consolidation
- **Newer project**: Karpenter is younger than CAS with a faster release cadence. Breaking changes between versions require careful upgrade planning
- **Spot interruption handling**: While Karpenter handles spot interruptions gracefully, services must tolerate sudden node termination. Graceful shutdown and pod disruption budgets are essential
- **Cost visibility**: Dynamic instance type selection makes cost forecasting less predictable than fixed ASG instance types

## Alternatives Considered

### Cluster Autoscaler with multiple ASGs
Keep CAS but add ASGs for different instance types to improve flexibility. Rejected because it increases configuration complexity without solving the slow provisioning or poor bin-packing problems. Managing 8-10 ASGs with different instance types, scaling policies, and launch templates is operationally expensive.

### KEDA for node scaling
Use KEDA (Kubernetes Event-Driven Autoscaling) for scaling. Rejected because KEDA is a pod autoscaler, not a node autoscaler. It complements (not replaces) a node autoscaler. We use HPA for pod scaling and Karpenter for node scaling.

### AWS Fargate for EKS
Run EKS pods on Fargate to eliminate node management entirely. Rejected because Fargate has limitations that affect our workloads: no DaemonSets (needed for log collection and monitoring agents), no GPU support, higher per-vCPU cost than EC2, and cold start latency of 30-60 seconds for new pods.

### Over-provisioning with fixed node count
Maintain a fixed fleet of nodes sized for peak load. Rejected because peak load is 3-4x baseline. Running peak capacity 24/7 wastes approximately 60-70% of compute spend during off-peak hours.

## References

- Karpenter documentation: https://karpenter.sh
- AWS EC2 Fleet API documentation
- ADR-002: EKS for Microservices (cluster configuration)
- Internal analysis: Karpenter vs CAS provisioning latency benchmarks (p50: 72s vs 312s)
