# ============================================================
# Datadog Monitors — Alerting as Code
# ============================================================

# ─── P1: API Error Rate > 1% for 5 minutes ──────────────
resource "datadog_monitor" "api_error_rate" {
  name = "[PrintForge] P1: API Error Rate > 1%"
  type = "metric alert"

  query = "sum(last_5m):sum:http_requests_total{service:order-service,status_code:5*}.as_count() / sum:http_requests_total{service:order-service}.as_count() * 100 > 1"

  message = <<-EOT
    {{#is_alert}}
    API error rate has exceeded 1% over the last 5 minutes.

    Current error rate: {{value}}%

    **Immediate Actions:**
    1. Check recent deployments: Was a canary recently promoted?
    2. Check downstream services: artist-service, search-service health
    3. Check database connections: RDS connection pool saturation
    4. Review error logs: `kubectl logs -n printforge -l app=order-service --tail=100`

    Runbook: https://github.com/printforge/docs/runbooks/incident-response.md
    Dashboard: https://app.datadoghq.com/dashboard/printforge-api

    @slack-platform-alerts @pagerduty-devops
    {{/is_alert}}
    {{#is_recovery}}
    API error rate has recovered to normal levels. Current: {{value}}%
    @slack-platform-alerts
    {{/is_recovery}}
  EOT

  monitor_thresholds {
    critical          = 1
    warning           = 0.5
    critical_recovery = 0.5
    warning_recovery  = 0.25
  }

  notify_no_data    = true
  no_data_timeframe = 10
  renotify_interval = 15
  escalation_message = "API error rate is still elevated after 15 minutes. Escalating."

  tags = ["service:order-service", "team:devops", "severity:p1"]
}

# ─── P2: API P99 Latency > 2 seconds ────────────────────
resource "datadog_monitor" "api_latency_p99" {
  name = "[PrintForge] P2: API P99 Latency > 2s"
  type = "metric alert"

  query = "percentile(last_5m):p99:http_request_duration_seconds{service:order-service} > 2"

  message = <<-EOT
    {{#is_alert}}
    API P99 latency has exceeded 2 seconds.

    Current P99: {{value}}s

    **Investigate:**
    1. Check database query performance
    2. Check Redis cache hit rate
    3. Review HPA — are pods under resource pressure?
    4. Check network policies for unexpected blocking

    @slack-platform-alerts
    {{/is_alert}}
  EOT

  monitor_thresholds {
    critical = 2
    warning  = 1
  }

  tags = ["service:order-service", "team:devops", "severity:p2"]
}

# ─── P1: Pod CrashLoopBackOff ────────────────────────────
resource "datadog_monitor" "pod_crashloop" {
  name = "[PrintForge] P1: Pod CrashLoopBackOff Detected"
  type = "metric alert"

  query = "max(last_5m):max:kubernetes.containers.restarts{kube_namespace:printforge} by {pod_name} > 3"

  message = <<-EOT
    {{#is_alert}}
    Pod {{pod_name.name}} is in CrashLoopBackOff ({{value}} restarts in 5m).

    **Actions:**
    1. Check pod logs: `kubectl logs -n printforge {{pod_name.name}} --previous`
    2. Check events: `kubectl describe pod -n printforge {{pod_name.name}}`
    3. Check if this correlates with a recent deployment
    4. Consider rolling back: `helm rollback <release> -n printforge`

    @slack-platform-alerts @pagerduty-devops
    {{/is_alert}}
  EOT

  monitor_thresholds {
    critical = 3
    warning  = 2
  }

  tags = ["team:devops", "severity:p1"]
}

# ─── P2: Error Budget Burn Rate ──────────────────────────
resource "datadog_monitor" "error_budget_burn" {
  name = "[PrintForge] P2: Error Budget Burn Rate > 2x"
  type = "slo alert"

  query = "error_budget(\"${datadog_service_level_objective.checkout_availability.id}\").over(\"7d\").percentage > 50"

  message = <<-EOT
    {{#is_alert}}
    API availability SLO error budget is burning at >2x normal rate.

    We have consumed {{value}}% of our 30-day error budget in the last 7 days.

    **Error Budget Policy:**
    - 50% consumed: Review error trends, investigate root causes
    - 75% consumed: Feature freeze, all effort on reliability
    - 100% consumed: Full incident response, postmortem required

    See: docs/sla/error-budget-policy.md

    @slack-platform-alerts
    {{/is_alert}}
  EOT

  monitor_thresholds {
    critical = 75
    warning  = 50
  }

  tags = ["team:devops", "severity:p2", "slo:checkout-availability"]
}

# ─── P2: Canary Rollback Detected ────────────────────────
resource "datadog_monitor" "canary_rollback" {
  name = "[PrintForge] P2: Canary Deployment Rollback"
  type = "event-v2 alert"

  query = "events(\"source:flagger status:error kube_namespace:printforge\").rollup(\"count\").last(\"5m\") > 0"

  message = <<-EOT
    {{#is_alert}}
    A canary deployment was rolled back by Flagger.

    **Actions:**
    1. Check which service was being deployed
    2. Review canary metrics in Datadog dashboard
    3. Check deployment logs in Buildkite
    4. Investigate root cause before retrying

    @slack-deployments @slack-platform-alerts
    {{/is_alert}}
  EOT

  monitor_thresholds {
    critical = 0
  }

  tags = ["team:devops", "severity:p2", "type:deployment"]
}

# ─── P3: Node Disk Pressure ─────────────────────────────
resource "datadog_monitor" "node_disk_pressure" {
  name = "[PrintForge] P3: Node Disk Pressure"
  type = "metric alert"

  query = "avg(last_10m):avg:system.disk.in_use{kube_cluster_name:${var.cluster_name}} by {host} > 0.85"

  message = <<-EOT
    {{#is_alert}}
    Node {{host.name}} disk usage is at {{value}}%.

    **Actions:**
    1. Check for excessive logging or container image buildup
    2. Consider draining the node: `kubectl drain {{host.name}} --ignore-daemonsets`
    3. Review container image cleanup policies

    @slack-platform-alerts
    {{/is_alert}}
  EOT

  monitor_thresholds {
    critical = 0.90
    warning  = 0.85
  }

  tags = ["team:devops", "severity:p3"]
}
