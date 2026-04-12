# EKS Node Replacement Runbook

**Last Updated**: 2024-03-15
**Owner**: Platform Engineering Team
**Related ADR**: ADR-009 (Karpenter over Cluster Autoscaler)

## Overview

This runbook covers the procedure for replacing EKS worker nodes. Common reasons for node replacement include: AMI updates, instance type changes, compromised nodes, hardware failures, and Karpenter's automatic node rotation (every 30 days via `expireAfter`).

## Prerequisites

- `kubectl` configured with EKS cluster credentials
- Sufficient cluster capacity to absorb pods from the draining node
- Pod Disruption Budgets (PDBs) configured for all production workloads

## Procedure: Graceful Node Replacement

### Step 1: Identify the Node

```bash
# List all nodes with status and instance type
kubectl get nodes -o wide

# Find nodes by instance ID (from AWS console or alert)
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.providerID}{"\n"}{end}'

# Check node conditions
kubectl describe node <node-name> | grep -A 5 "Conditions:"

# Check what pods are running on the node
kubectl get pods --all-namespaces --field-selector spec.nodeName=<node-name> -o wide
```

### Step 2: Verify Cluster Capacity

Before removing a node, ensure the remaining nodes can absorb the workload:

```bash
# Check current cluster resource utilization
kubectl top nodes

# Check if other nodes have capacity
kubectl describe nodes | grep -A 5 "Allocated resources:"

# Verify Karpenter can provision a replacement (check NodePool limits)
kubectl get nodepool default -o yaml | grep -A 5 "limits:"

# Check for pending pods that indicate capacity pressure
kubectl get pods --all-namespaces | grep Pending
```

If the cluster is near capacity, scale up first:

```bash
# Temporarily increase HPA minimums if needed
kubectl -n marketplace patch hpa product-service \
  -p '{"spec":{"minReplicas": 5}}'

# Wait for Karpenter to provision additional nodes
kubectl get nodes -w
```

### Step 3: Cordon the Node

Cordoning marks the node as unschedulable. No new pods will be placed on it.

```bash
# Cordon the node
kubectl cordon <node-name>

# Verify the node is cordoned
kubectl get node <node-name>
# STATUS should show "Ready,SchedulingDisabled"
```

### Step 4: Drain the Node

Draining evicts all pods from the node, respecting PodDisruptionBudgets.

```bash
# Drain the node with safety guards
kubectl drain <node-name> \
  --ignore-daemonsets \
  --delete-emptydir-data \
  --grace-period=60 \
  --timeout=300s

# Explanation of flags:
# --ignore-daemonsets: DaemonSet pods cannot be evicted; skip them
# --delete-emptydir-data: Allow eviction of pods using emptyDir volumes
# --grace-period=60: Give pods 60 seconds for graceful shutdown
# --timeout=300s: Fail if drain does not complete within 5 minutes
```

### Handling Drain Failures

**PDB violation** -- drain is blocked because evicting a pod would violate its PodDisruptionBudget:

```bash
# Check which PDB is blocking
kubectl get pdb --all-namespaces

# Check the specific PDB status
kubectl -n marketplace get pdb product-service-pdb -o yaml
# Look at "disruptionsAllowed" -- if 0, the PDB is blocking

# Options:
# 1. Wait for the application to scale up (HPA should add pods to other nodes)
# 2. If safe, temporarily adjust the PDB:
kubectl -n marketplace patch pdb product-service-pdb \
  -p '{"spec":{"minAvailable": 1}}'  # Lower threshold temporarily

# After drain completes, restore the PDB
kubectl -n marketplace patch pdb product-service-pdb \
  -p '{"spec":{"minAvailable": 2}}'
```

**Stuck pods** -- pods that do not terminate within the grace period:

```bash
# Check which pods are still on the node
kubectl get pods --all-namespaces --field-selector spec.nodeName=<node-name>

# Force-delete stuck pods (last resort)
kubectl -n <namespace> delete pod <pod-name> --force --grace-period=0
```

### Step 5: Verify Pod Rescheduling

```bash
# Verify all evicted pods are running on other nodes
kubectl get pods --all-namespaces -o wide | grep -v <node-name>

# Check for any pods in non-Running state
kubectl get pods --all-namespaces | grep -v Running | grep -v Completed

# Verify service health
kubectl -n marketplace get endpoints product-service
# Ensure endpoint count matches expected replica count
```

### Step 6: Terminate the Node

**If managed by Karpenter** (preferred):

```bash
# Delete the node object; Karpenter will terminate the EC2 instance
kubectl delete node <node-name>

# Karpenter will automatically provision a replacement if needed
# Monitor with:
kubectl get nodes -w
```

**If managed by a managed node group (fallback)**:

```bash
# Get the instance ID
INSTANCE_ID=$(kubectl get node <node-name> \
  -o jsonpath='{.spec.providerID}' | cut -d'/' -f5)

# Terminate the instance (ASG will replace it)
aws ec2 terminate-instances --instance-ids $INSTANCE_ID

# Verify the new node joins the cluster
kubectl get nodes -w
```

### Step 7: Post-Replacement Verification

```bash
# Verify new node is Ready
kubectl get nodes

# Verify all pods are healthy
kubectl get pods --all-namespaces | grep -v Running | grep -v Completed

# Check Karpenter logs for any provisioning issues
kubectl -n karpenter logs -l app.kubernetes.io/name=karpenter --tail=50

# Verify canary deployments are not affected
kubectl -n marketplace get canary
```

## Batch Node Replacement

For rolling replacement of all nodes (e.g., AMI update):

```bash
# Get all node names
NODES=$(kubectl get nodes -o jsonpath='{.items[*].metadata.name}')

# Replace nodes one at a time
for NODE in $NODES; do
  echo "--- Replacing node: $NODE ---"

  # Cordon
  kubectl cordon $NODE

  # Drain
  kubectl drain $NODE \
    --ignore-daemonsets \
    --delete-emptydir-data \
    --grace-period=60 \
    --timeout=300s

  # Delete node (Karpenter provisions replacement)
  kubectl delete node $NODE

  # Wait for replacement node to be Ready
  echo "Waiting for replacement node..."
  sleep 30
  kubectl wait --for=condition=Ready node --all --timeout=300s

  # Verify all pods are healthy before proceeding
  UNHEALTHY=$(kubectl get pods --all-namespaces | grep -v Running | grep -v Completed | grep -v NAME | wc -l)
  if [ "$UNHEALTHY" -gt 0 ]; then
    echo "WARNING: $UNHEALTHY unhealthy pods detected. Pausing batch replacement."
    kubectl get pods --all-namespaces | grep -v Running | grep -v Completed
    break
  fi

  echo "Node $NODE replaced successfully."
done
```

## Karpenter Automatic Node Rotation

Karpenter automatically replaces nodes when:

- **expireAfter** (30 days): Node has been running longer than the configured TTL
- **Drift detection**: Node's launch template or AMI no longer matches the EC2NodeClass
- **Consolidation**: Node is underutilized and pods can fit on fewer nodes

Karpenter handles cordon, drain, and terminate automatically, respecting PDBs. No manual intervention is required unless Karpenter encounters a PDB violation it cannot resolve.

### Monitoring Karpenter Rotation

```bash
# Check Karpenter logs for rotation events
kubectl -n karpenter logs -l app.kubernetes.io/name=karpenter --tail=100 | grep -i "disrupt\|expire\|consolidat"

# Check node ages
kubectl get nodes -o custom-columns='NAME:.metadata.name,AGE:.metadata.creationTimestamp'
```

## Emergency: Compromised Node

If a node is suspected to be compromised:

1. **Do NOT drain** -- this sends traffic to other pods during shutdown, potentially spreading the compromise
2. **Cordon immediately**:
   ```bash
   kubectl cordon <node-name>
   ```
3. **Isolate the node** at the network level:
   ```bash
   # Get the instance ID
   INSTANCE_ID=$(kubectl get node <node-name> -o jsonpath='{.spec.providerID}' | cut -d'/' -f5)

   # Apply a restrictive security group that blocks all traffic
   aws ec2 modify-instance-attribute \
     --instance-id $INSTANCE_ID \
     --groups sg-isolated-quarantine
   ```
4. **Notify security team** in Slack #security-incidents
5. **Preserve the instance** for forensic analysis -- do NOT terminate it
6. **Delete the node object** to remove pods from service discovery:
   ```bash
   kubectl delete node <node-name>
   ```
7. **Follow incident response procedure** (see `incident-response.md`)

## Troubleshooting

| Problem | Cause | Solution |
|---|---|---|
| Drain hangs indefinitely | PDB prevents eviction | Check PDB `disruptionsAllowed`, temporarily adjust if safe |
| Pods stuck in Terminating | Finalizer or graceful shutdown timeout | Force-delete with `--force --grace-period=0` |
| New node not joining | IAM role or security group misconfigured | Check Karpenter logs, verify EC2NodeClass configuration |
| Pods not scheduling on new node | Taints, node selector, or affinity mismatch | Check pod spec for nodeSelector/affinity constraints |
| Karpenter not provisioning | NodePool limits reached | Check `kubectl get nodepool -o yaml` for cpu/memory limits |
