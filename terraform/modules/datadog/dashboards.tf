# ============================================================
# Datadog Dashboards — Observability as Code
# ============================================================

resource "datadog_dashboard_json" "service_overview" {
  dashboard = jsonencode({
    title       = "PrintForge - Service Overview"
    description = "Golden signals for all marketplace services"
    layout_type = "ordered"
    widgets = [
      {
        definition = {
          title = "Request Rate (all services)"
          type  = "timeseries"
          requests = [{
            q            = "sum:http_requests_total{service:product-service}.as_rate(), sum:http_requests_total{service:order-service}.as_rate(), sum:http_requests_total{service:search-service}.as_rate(), sum:http_requests_total{service:artist-service}.as_rate()"
            display_type = "line"
          }]
        }
      },
      {
        definition = {
          title = "Error Rate by Service"
          type  = "timeseries"
          requests = [{
            q            = "sum:http_requests_total{service:order-service,status_code:5*}.as_rate() / sum:http_requests_total{service:order-service}.as_rate() * 100, sum:http_requests_total{service:product-service,status_code:5*}.as_rate() / sum:http_requests_total{service:product-service}.as_rate() * 100"
            display_type = "line"
          }]
        }
      },
      {
        definition = {
          title = "P99 Latency by Service"
          type  = "timeseries"
          requests = [{
            q            = "p99:http_request_duration_seconds{service:product-service}, p99:http_request_duration_seconds{service:order-service}, p99:http_request_duration_seconds{service:search-service}"
            display_type = "line"
          }]
        }
      },
      {
        definition = {
          title = "SLO Status"
          type  = "slo_list"
          requests = [{
            request_type = "slo_list"
            query = {
              query_string = "team:devops"
              limit        = 10
            }
          }]
        }
      },
      {
        definition = {
          title = "Pod Status"
          type  = "hostmap"
          requests = [{
            q = "avg:kubernetes.pods.running{kube_namespace:printforge} by {pod_name}"
          }]
        }
      },
      {
        definition = {
          title = "Orders Per Minute"
          type  = "query_value"
          requests = [{
            q          = "sum:checkout_attempts_total{service:order-service,status:success}.as_rate() * 60"
            aggregator = "last"
          }]
          precision = 1
        }
      }
    ]
    template_variables = [
      { name = "env", prefix = "env", default = "production" },
      { name = "service", prefix = "service", default = "*" }
    ]
  })
}

# DORA Metrics Dashboard
resource "datadog_dashboard_json" "dora_metrics" {
  dashboard = jsonencode({
    title       = "PrintForge - DORA Metrics"
    description = "Engineering effectiveness: Deploy frequency, lead time, MTTR, change failure rate"
    layout_type = "ordered"
    widgets = [
      {
        definition = {
          title = "Deployment Frequency (last 30d)"
          type  = "query_value"
          requests = [{
            q          = "sum:deployments.total{env:production}.as_count().rollup(sum, 2592000)"
            aggregator = "last"
          }]
        }
      },
      {
        definition = {
          title = "Change Failure Rate"
          type  = "query_value"
          requests = [{
            q          = "sum:deployments.rollback{env:production}.as_count() / sum:deployments.total{env:production}.as_count() * 100"
            aggregator = "last"
          }]
          precision       = 1
          custom_unit     = "%"
        }
      },
      {
        definition = {
          title = "Mean Time to Recovery (MTTR)"
          type  = "query_value"
          requests = [{
            q          = "avg:incidents.duration{team:devops,severity:p1}"
            aggregator = "avg"
          }]
          custom_unit = "min"
        }
      },
      {
        definition = {
          title = "Deployments Over Time"
          type  = "timeseries"
          requests = [{
            q            = "sum:deployments.total{env:production}.as_count().rollup(sum, 86400)"
            display_type = "bars"
          }]
        }
      }
    ]
  })
}
