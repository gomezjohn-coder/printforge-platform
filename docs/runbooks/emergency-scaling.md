# Emergency Scaling Runbook

**Last Updated**: 2024-03-15
**Owner**: Platform Engineering Team
**Related ADRs**: ADR-006 (SLO-Based Alerting), ADR-009 (Karpenter)

## Overview

This runbook covers emergency scaling procedures when automated scaling (HPA + Karpenter) is insufficient to handle traffic spikes or when immediate capacity increase is required. Use this when SLO burn rate alerts fire and the root cause is insufficient capacity rather than a bug or external dependency failure.

## When to Use This Runbook

- SLO burn rate alert fires and latency is the primary affected metric
- Pod CPU/memory utilization is sustained above 85%
- Pods are in `Pending` state due to insufficient node capacity
- A planned high-traffic event (product launch, marketing campaign) requires pre-scaling
- HPA is at maximum replicas and latency is still elevated

## Step 1: Assess Current State

```bash
# Check pod resource utilization
kubectl -n marketplace top pods -l app=product-service

# Check HPA status
kubectl -n marketplace get hpa
# Look at TARGETS vs MINPODS/MAXPODS/REPLICAS

# Check node utilization
kubectl top nodes

# Check for pending pods
kubectl get pods --all-namespaces | grep Pending

# Check Karpenter provisioning status
kubectl -n karpenter logs -l app.kubernetes.io/name=karpenter --tail=50 | grep -i "provision\|launch"
```

## Step 2: Scale Pods (HPA Override)

### Increase HPA Minimum Replicas

```bash
# Current HPA status
kubectl -n marketplace get hpa product-service -o yaml

# Override minimum replicas (immediate scale-up)
kubectl -n marketplace patch hpa product-service \
  -p '{"spec":{"minReplicas": 10}}'

# Verify pods are being created
kubectl -n marketplace get pods -l app=product-service -w

# For all services at once:
for svc in product-service marketplace-web artist-service search-service; do
  kubectl -n marketplace patch hpa $svc \
    -p '{"spec":{"minReplicas": 8}}'
  echo "Scaled $svc HPA minimum to 8"
done
```

### Increase HPA Maximum Replicas

If the HPA is already at max and still needs to scale:

```bash
# Increase max replicas
kubectl -n marketplace patch hpa product-service \
  -p '{"spec":{"maxReplicas": 30}}'
```

### Direct Replica Count Override

If HPA is not responding quickly enough:

```bash
# Scale the deployment directly
# WARNING: HPA will revert this within 1-2 minutes unless you also adjust HPA
kubectl -n marketplace scale deployment product-service --replicas=15

# To make it stick, adjust HPA first:
kubectl -n marketplace patch hpa product-service \
  -p '{"spec":{"minReplicas": 15}}'
```

## Step 3: Scale Nodes (If Pods Are Pending)

### Verify Pod Scheduling Issues

```bash
# Check why pods are pending
kubectl -n marketplace describe pod <pending-pod-name> | grep -A 10 "Events:"

# Common reasons:
# - Insufficient cpu/memory on existing nodes
# - Node selector/affinity constraints
# - Taint/toleration mismatches
```

### Karpenter: Trigger Immediate Node Provisioning

Karpenter provisions nodes automatically when pods are pending. If provisioning seems slow:

```bash
# Check Karpenter controller health
kubectl -n karpenter get pods

# Check Karpenter logs for errors
kubectl -n karpenter logs -l app.kubernetes.io/name=karpenter --tail=100 | grep -i "error\|failed\|unable"

# Check NodePool limits (may be exhausted)
kubectl get nodepool default -o yaml | grep -A 5 "limits:"

# If NodePool limits are reached, temporarily increase them
kubectl patch nodepool default --type=merge -p '{"spec":{"limits":{"cpu":"256","memory":"1024Gi"}}}'

# Restart Karpenter if it appears stuck
kubectl -n karpenter rollout restart deployment/karpenter
```

### Manual Node Addition (If Karpenter Fails)

As a last resort, manually create EC2 instances:

```bash
# Launch instances using the Karpenter node template
aws ec2 run-instances \
  --image-id <eks-optimized-ami-id> \
  --instance-type c5.2xlarge \
  --count 3 \
  --subnet-id <subnet-id> \
  --security-group-ids <sg-id> \
  --iam-instance-profile Name=KarpenterNodeInstanceProfile \
  --user-data file://node-userdata.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=kubernetes.io/cluster/printforge-eks,Value=owned},{Key=manual-emergency,Value=true}]'

# Nodes should register with the cluster automatically via the bootstrap script
# Verify:
kubectl get nodes -w
```

## Step 4: Scale ECS Monolith (If Applicable)

If the monolith is experiencing capacity issues:

```bash
# Scale ECS service
aws ecs update-service \
  --cluster printforge-legacy \
  --service monolith-web \
  --desired-count 8

# Monitor task launches
watch -n 5 "aws ecs describe-services \
  --cluster printforge-legacy \
  --services monolith-web \
  --query 'services[0].{running:runningCount,desired:desiredCount}'"
```

## Step 5: Verify Scaling Effectiveness

```bash
# Check pod count and status
kubectl -n marketplace get pods -l app=product-service | wc -l

# Check latency improvement
# Navigate to: https://grafana.printforge.io/d/slo-overview
# or query Prometheus:
kubectl -n monitoring port-forward svc/prometheus-server 9090:80 &
curl -s 'localhost:9090/api/v1/query?query=histogram_quantile(0.99,sum(rate(http_request_duration_seconds_bucket{service="order-service"}[5m]))by(le))' | jq '.data.result[0].value[1]'

# Check error rate improvement
curl -s 'localhost:9090/api/v1/query?query=sum(rate(http_requests_total{status=~"5..",service="order-service"}[5m]))/sum(rate(http_requests_total{service="order-service"}[5m]))' | jq '.data.result[0].value[1]'

# Check SLO burn rate
curl -s 'localhost:9090/api/v1/query?query=slo:burn_rate:5m{service="order-service"}' | jq '.data.result[0].value[1]'
```

## Step 6: Pre-Scaling for Planned Events

For anticipated high-traffic events (product launches, marketing campaigns):

### The Day Before

```bash
# Scale HPA minimums to anticipated baseline
kubectl -n marketplace patch hpa product-service \
  -p '{"spec":{"minReplicas": 10, "maxReplicas": 40}}'

kubectl -n marketplace patch hpa marketplace-web \
  -p '{"spec":{"minReplicas": 8, "maxReplicas": 30}}'

kubectl -n marketplace patch hpa search-service \
  -p '{"spec":{"minReplicas": 6, "maxReplicas": 25}}'

# Verify nodes are provisioned for the new pod count
kubectl get nodes
kubectl top nodes

# Warm up Cloudflare cache if applicable
# Preload popular product pages
```

### During the Event

```bash
# Monitor in real time
watch -n 10 "kubectl -n marketplace get hpa && echo '---' && kubectl top nodes"

# Keep Grafana SLO dashboard open
# Be ready to increase HPA max if needed
```

### After the Event

```bash
# Scale back HPA minimums gradually (avoid sudden pod termination)
kubectl -n marketplace patch hpa product-service \
  -p '{"spec":{"minReplicas": 5}}'

# Wait 15 minutes, then reduce further
kubectl -n marketplace patch hpa product-service \
  -p '{"spec":{"minReplicas": 3}}'

# Karpenter will consolidate underutilized nodes automatically
# Monitor node count returning to normal
kubectl get nodes -w

# Restore NodePool limits if they were increased
kubectl patch nodepool default --type=merge -p '{"spec":{"limits":{"cpu":"160","memory":"640Gi"}}}'
```

## Post-Emergency Checklist

- [ ] SLO burn rate returned to normal (< 1x)
- [ ] Latency within SLO targets
- [ ] Error rate within SLO targets
- [ ] Pod count stable at appropriate level
- [ ] Node count stable (Karpenter consolidation not fighting HPA scale-up)
- [ ] HPA minimums restored to non-emergency values (if emergency scaling)
- [ ] NodePool limits restored to standard values (if increased)
- [ ] Incident documented if SLO was breached (see `incident-response.md`)
- [ ] Consider whether HPA/Karpenter configuration needs permanent adjustment

## Quick Reference: Scaling Commands

```bash
# Pod scaling
kubectl -n marketplace patch hpa <service> -p '{"spec":{"minReplicas": N}}'
kubectl -n marketplace patch hpa <service> -p '{"spec":{"maxReplicas": N}}'
kubectl -n marketplace scale deployment <service> --replicas=N

# Node scaling
kubectl patch nodepool default --type=merge -p '{"spec":{"limits":{"cpu":"N"}}}'
kubectl -n karpenter rollout restart deployment/karpenter

# ECS scaling
aws ecs update-service --cluster printforge-legacy --service monolith-web --desired-count N

# Monitoring
kubectl -n marketplace get hpa
kubectl -n marketplace top pods
kubectl top nodes
kubectl get pods --all-namespaces | grep Pending
```
