# ADR-007: Buildkite for CD, GitHub Actions for CI

**Status**: Accepted
**Date**: 2024-02-15
**Deciders**: Platform Engineering Team
**Context Area**: CI/CD Pipeline Architecture

## Context

PrintForge needs CI/CD pipelines for four microservices and one legacy monolith. The pipeline requirements fall into two distinct categories with different characteristics:

**CI (Continuous Integration)**: lint, unit tests, integration tests, container image builds, security scanning. These run on every pull request, are stateless, and need fast feedback loops. They are triggered by code changes and do not touch production infrastructure.

**CD (Continuous Deployment)**: Helm upgrades, canary deployments, rollback orchestration, environment promotion, infrastructure changes. These modify production state, require access to EKS clusters and AWS credentials, need audit trails, and must support manual approval gates.

Mixing these concerns in a single platform creates problems:

- CI runners with production AWS credentials expand the attack surface for supply chain attacks
- GitHub Actions' hosted runners have limited customization for CD workflows that need kubectl, helm, and AWS CLI with specific IAM roles
- Canary deployment orchestration requires long-running pipelines (10+ minutes) with conditional logic that is awkward in GitHub Actions' YAML syntax
- Rollback workflows need to be triggerable independently of code changes

## Decision

Use **GitHub Actions** for CI and **Buildkite** for CD, with a clear handoff boundary at the container image push to ECR.

### CI Pipeline (GitHub Actions)

Triggered on every pull request and merge to main:

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: make lint

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: make test
      - run: make test-integration

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          severity: CRITICAL,HIGH

  build-push:
    needs: [lint, test, security-scan]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::role/github-ecr-push
          aws-region: us-west-2
      - run: |
          make docker-build
          make docker-push TAG=${{ github.sha }}
      - run: |
          curl -X POST "https://api.buildkite.com/v2/..." \
            -d '{"commit": "${{ github.sha }}", "branch": "main"}'
```

### CD Pipeline (Buildkite)

Triggered by GitHub Actions after successful image push, or manually for rollbacks:

```yaml
# .buildkite/pipeline.yml
steps:
  - label: ":helm: Deploy to Staging"
    command: ./scripts/deploy.sh staging
    env:
      ENVIRONMENT: staging
      IMAGE_TAG: "${BUILDKITE_COMMIT}"

  - label: ":mag: Staging Smoke Tests"
    command: ./scripts/smoke-test.sh staging
    depends_on: "deploy-staging"

  - block: ":rocket: Deploy to Production?"
    prompt: "Staging smoke tests passed. Deploy to production?"
    branches: "main"

  - label: ":kubernetes: Deploy to Production (Canary)"
    command: ./scripts/deploy.sh production
    env:
      ENVIRONMENT: production
      IMAGE_TAG: "${BUILDKITE_COMMIT}"
    depends_on: "deploy-production-gate"

  - label: ":eyes: Monitor Canary"
    command: ./scripts/monitor-canary.sh
    timeout_in_minutes: 15
    depends_on: "deploy-production"

  - label: ":rewind: Rollback (if needed)"
    command: ./scripts/rollback.sh production
    depends_on: "monitor-canary"
    if: "build.state == 'failing'"
```

### Handoff Boundary

```
GitHub Actions                    Buildkite

PR opened ──> lint ──> test
           ──> security scan

Merge to main ──> build ──> push to ECR ──> trigger ──> staging deploy
                                                     ──> smoke tests
                                                     ──> [manual gate]
                                                     ──> prod canary
                                                     ──> monitor
                                                     ──> promote/rollback
```

### Security Boundary

| Credential | GitHub Actions | Buildkite |
|---|---|---|
| ECR push | Yes (OIDC role) | No |
| EKS cluster access | No | Yes (agent IAM role) |
| Helm release | No | Yes |
| AWS production | No | Yes (scoped IAM) |
| Slack notifications | No | Yes |
| PagerDuty | No | Yes |

### Buildkite Agent Configuration

Buildkite agents run on dedicated EC2 instances within the production VPC:

- IAM role scoped to EKS, ECR read, Secrets Manager
- Agents auto-scale based on pipeline queue depth
- Agent stack managed via CloudFormation (Buildkite Elastic CI Stack)
- Agents have kubectl and helm pre-installed with kubeconfig for staging and production clusters

## Consequences

### Positive

- **Security isolation**: CI runners never have production credentials. A compromised GitHub Actions workflow cannot deploy to production or access the EKS cluster
- **Right tool for the job**: GitHub Actions excels at stateless, parallelized CI tasks. Buildkite excels at stateful, sequential CD workflows with approval gates
- **Manual approval gates**: Buildkite's `block` step provides production deployment gates without workarounds
- **Rollback independence**: Rollback pipelines can be triggered directly in Buildkite without a code change or GitHub event
- **Audit trail**: Buildkite provides a clear audit log of who approved and triggered each production deployment
- **Agent customization**: Buildkite agents run on our infrastructure with exactly the tools and credentials needed

### Negative

- **Two systems to maintain**: Engineers must understand both GitHub Actions and Buildkite pipeline syntax
- **Handoff complexity**: The trigger from GitHub Actions to Buildkite is an API call that must be monitored for failures
- **Cost**: Buildkite agents on EC2 add infrastructure cost on top of GitHub Actions (which is free for public repos). Estimated $150/month for agent fleet
- **Context switching**: Developers check CI status in GitHub and CD status in Buildkite. Buildkite's GitHub integration mitigates this by posting status checks

## Alternatives Considered

### GitHub Actions for everything
Run both CI and CD in GitHub Actions using self-hosted runners for CD workflows. Rejected because GitHub Actions' environment protection rules are less flexible than Buildkite's block steps, self-hosted runner management adds complexity, and the security boundary between CI and CD is harder to enforce in a single platform.

### Buildkite for everything
Run CI on Buildkite agents alongside CD. Rejected because Buildkite requires managing agent infrastructure for CI tasks that GitHub's hosted runners handle for free. For stateless CI workloads, managed runners are more cost-effective.

### ArgoCD for deployments
Use ArgoCD's GitOps model for CD with GitHub Actions for CI. Rejected because ArgoCD's sync-based model does not natively support canary deployments with Flagger. ArgoCD would manage desired state while Flagger manages progressive delivery, creating overlapping responsibilities. Buildkite's imperative pipeline model integrates more cleanly with Flagger's webhook-based promotion flow.

### Jenkins
Use Jenkins for CD pipelines. Rejected due to the operational overhead of managing Jenkins infrastructure, plugin maintenance, and the team's preference for pipeline-as-code in version control over Jenkins' UI-centric configuration.

## References

- Buildkite documentation: Pipeline configuration
- GitHub Actions documentation: OIDC for AWS
- ADR-003: Flagger Canary Deployments (Buildkite monitors canary status)
