# ECS Fargate Service Recovery Runbook

**Last Updated**: 2024-03-15
**Owner**: Platform Engineering Team
**Related ADR**: ADR-002 (EKS for Microservices, ECS Fargate for Monolith)

## Overview

This runbook covers recovery procedures for the PrintForge legacy monolith running on ECS Fargate. The monolith handles legacy checkout, artist payouts, admin dashboard, and endpoints that have not yet migrated to EKS microservices (see ADR-010).

## Service Architecture

```
CloudFront/Cloudflare -> ALB -> ECS Service (Fargate)
                                  |-- Task 1 (Rails app)
                                  |-- Task 2 (Rails app)
                                  |-- Task 3 (Rails app)
                                  |
                                  v
                              RDS PostgreSQL
                              ElastiCache Redis
                              S3 (assets)
```

- **Cluster**: `printforge-legacy`
- **Service**: `monolith-web`
- **Task Definition**: `monolith-web:latest`
- **Desired Count**: 3 (minimum), scales to 10
- **Health Check**: `/health` endpoint, 30s interval

## Scenario 1: Task Failures (Tasks Stopping and Restarting)

### Detection

- CloudWatch alarm: `ECS-TaskFailures-High`
- ECS service events show repeated task starts and stops
- ALB target group shows unhealthy targets

### Diagnosis

```bash
# Check service events (shows task start/stop reasons)
aws ecs describe-services \
  --cluster printforge-legacy \
  --services monolith-web \
  --query 'services[0].events[:10]' \
  --output table

# Check stopped tasks for exit reasons
aws ecs list-tasks \
  --cluster printforge-legacy \
  --service-name monolith-web \
  --desired-status STOPPED \
  --query 'taskArns[:5]'

# Get details of a stopped task
aws ecs describe-tasks \
  --cluster printforge-legacy \
  --tasks <task-arn> \
  --query 'tasks[0].{stopCode:stopCode,stoppedReason:stoppedReason,containers:containers[*].{name:name,exitCode:exitCode,reason:reason}}'
```

### Common Causes and Fixes

**OutOfMemory (exit code 137)**:
```bash
# Check current memory allocation
aws ecs describe-task-definition \
  --task-definition monolith-web \
  --query 'taskDefinition.containerDefinitions[0].{memory:memory,memoryReservation:memoryReservation}'

# If memory is insufficient, register a new task definition with increased memory
# Update the task definition JSON and register:
aws ecs register-task-definition --cli-input-json file://task-definition-updated.json

# Update the service to use the new task definition
aws ecs update-service \
  --cluster printforge-legacy \
  --service monolith-web \
  --task-definition monolith-web:<new-revision>
```

**Health check failures (task starts but ALB marks it unhealthy)**:
```bash
# Check ALB target group health
aws elbv2 describe-target-health \
  --target-group-arn <target-group-arn>

# Check application logs for startup errors
aws logs get-log-events \
  --log-group-name /ecs/monolith-web \
  --log-stream-name <log-stream> \
  --start-from-head \
  --limit 100

# Common causes:
# - Database connection failures (check RDS status)
# - Redis connection failures (check ElastiCache)
# - Missing environment variables (check task definition)
# - Slow startup exceeding health check grace period
```

**Container image pull failures**:
```bash
# Check if ECR repository is accessible
aws ecr describe-images \
  --repository-name monolith-web \
  --image-ids imageTag=latest

# Check task execution role has ECR pull permissions
aws iam get-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-name ecr-pull-policy
```

## Scenario 2: Circuit Breaker Triggered

ECS deployment circuit breaker stops rolling out a new task definition when tasks repeatedly fail to stabilize.

### Detection

- ECS service event: "service monolith-web deployment circuit breaker triggered"
- Service is running the previous task definition revision

### Diagnosis

```bash
# Check service deployment status
aws ecs describe-services \
  --cluster printforge-legacy \
  --services monolith-web \
  --query 'services[0].deployments'

# Look for:
# - PRIMARY deployment with previous task definition (still serving traffic)
# - ACTIVE deployment with new task definition (failed, being rolled back)

# Check the failed task definition for issues
aws ecs describe-task-definition \
  --task-definition monolith-web:<failed-revision> \
  --query 'taskDefinition.containerDefinitions[0].{image:image,environment:environment}'
```

### Resolution

```bash
# The circuit breaker has already rolled back to the previous version
# Verify the service is stable with the previous task definition
aws ecs describe-services \
  --cluster printforge-legacy \
  --services monolith-web \
  --query 'services[0].{status:status,runningCount:runningCount,desiredCount:desiredCount}'

# Investigate why the new task definition failed:
# 1. Check logs from the failed tasks
# 2. Verify the container image is correct
# 3. Check environment variable changes
# 4. Test the image locally

# Once the issue is fixed, deploy the corrected task definition
aws ecs update-service \
  --cluster printforge-legacy \
  --service monolith-web \
  --task-definition monolith-web:<corrected-revision>
```

## Scenario 3: Force New Deployment

When you need to restart all tasks without changing the task definition (e.g., to pick up rotated secrets or clear in-memory state).

```bash
# Force a new deployment (replaces all tasks gradually)
aws ecs update-service \
  --cluster printforge-legacy \
  --service monolith-web \
  --force-new-deployment

# Monitor the deployment
watch -n 5 "aws ecs describe-services \
  --cluster printforge-legacy \
  --services monolith-web \
  --query 'services[0].{runningCount:runningCount,desiredCount:desiredCount,deployments:deployments[*].{status:status,runningCount:runningCount,desiredCount:desiredCount}}' \
  --output table"

# The service replaces tasks one at a time (or per deployment configuration)
# Minimum healthy percent: 100% (at least N tasks running at all times)
# Maximum percent: 200% (can temporarily run 2x tasks during deployment)
```

## Scenario 4: Service Completely Down

All tasks have stopped and the service cannot start new ones.

### Immediate Actions

```bash
# Check service status
aws ecs describe-services \
  --cluster printforge-legacy \
  --services monolith-web \
  --query 'services[0].{status:status,runningCount:runningCount,events:events[:5]}'

# Check if the issue is Fargate capacity
# Look for "unable to place a task" in events

# Check RDS availability (common root cause)
aws rds describe-db-instances \
  --db-instance-identifier printforge-legacy \
  --query 'DBInstances[0].{status:DBInstanceStatus,endpoint:Endpoint}'

# Check ElastiCache
aws elasticache describe-cache-clusters \
  --cache-cluster-id printforge-redis \
  --query 'CacheClusters[0].CacheClusterStatus'
```

### Recovery Steps

1. **Fix the root cause** (database down, secrets expired, image missing)

2. **Update desired count to 0, then back up** (reset the service):
```bash
# Scale down
aws ecs update-service \
  --cluster printforge-legacy \
  --service monolith-web \
  --desired-count 0

# Wait for tasks to stop
sleep 30

# Scale back up
aws ecs update-service \
  --cluster printforge-legacy \
  --service monolith-web \
  --desired-count 3
```

3. **If the service definition is corrupted, recreate it**:
```bash
# Delete and recreate the service (last resort)
aws ecs delete-service \
  --cluster printforge-legacy \
  --service monolith-web \
  --force

# Wait for deletion
aws ecs wait services-inactive \
  --cluster printforge-legacy \
  --services monolith-web

# Recreate from Terraform
cd infrastructure/terraform/ecs
terraform apply -target=aws_ecs_service.monolith_web
```

## Scenario 5: Scaling Issues

### Manual Scale Up

```bash
# Increase desired count
aws ecs update-service \
  --cluster printforge-legacy \
  --service monolith-web \
  --desired-count 6

# Verify tasks are starting
aws ecs list-tasks \
  --cluster printforge-legacy \
  --service-name monolith-web \
  --desired-status RUNNING
```

### Auto Scaling Not Working

```bash
# Check Application Auto Scaling policies
aws application-autoscaling describe-scaling-policies \
  --service-namespace ecs \
  --resource-id service/printforge-legacy/monolith-web

# Check scaling activities
aws application-autoscaling describe-scaling-activities \
  --service-namespace ecs \
  --resource-id service/printforge-legacy/monolith-web \
  --max-results 10

# Check CloudWatch alarms driving auto scaling
aws cloudwatch describe-alarms \
  --alarm-name-prefix "ECS-monolith-web"
```

## Monitoring and Dashboards

| Dashboard | Location | Purpose |
|---|---|---|
| ECS Service Health | CloudWatch > ECS > printforge-legacy | Task count, CPU, memory |
| ALB Metrics | CloudWatch > ALB > monolith-alb | Request count, error rate, latency |
| Application Logs | CloudWatch Logs > /ecs/monolith-web | Application error logs |
| RDS Performance | CloudWatch > RDS > printforge-legacy | DB connections, query latency |
| Grafana (consolidated) | grafana.printforge.io/d/ecs-monolith | Unified view via CloudWatch data source |

## Key AWS Resources

| Resource | Identifier |
|---|---|
| ECS Cluster | `printforge-legacy` |
| ECS Service | `monolith-web` |
| Task Definition | `monolith-web` |
| ALB | `monolith-alb` |
| Target Group | `monolith-web-tg` |
| RDS Instance | `printforge-legacy` |
| ElastiCache | `printforge-redis` |
| Log Group | `/ecs/monolith-web` |
| ECR Repository | `monolith-web` |

## Post-Recovery Checklist

- [ ] Service running desired task count
- [ ] ALB health checks passing for all targets
- [ ] Application responding to requests (check `/health`)
- [ ] Error rate returned to baseline in CloudWatch
- [ ] No error logs in CloudWatch Logs
- [ ] Auto scaling policies are active
- [ ] Notify team in Slack #incidents if incident was declared
