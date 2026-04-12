# ============================================================
# Datadog SLOs — Service Level Objectives as Code
# ============================================================
# Defines the reliability contract for PrintForge's marketplace.
# The four headline SLOs are:
#   1. Checkout Availability     — 99.9%  over 30d   (order-service)
#   2. Product Page Latency      — 99% < 300ms p99   (product-service)
#   3. Search Latency            — 95% < 200ms p99   (search-service)
#   4. Order Success Rate        — 99.95% over 30d   (order-service, biz SLI)
#
# See ADR-006: SLO-Based Alerting
# See docs/sla/error-budget-policy.md
# ============================================================

terraform {
  required_version = ">= 1.5"
  required_providers {
    datadog = { source = "DataDog/datadog"; version = "~> 3.30" }
  }
}

# ─── Checkout Availability SLO — 99.9% over 30 days ──────
# This is the headline reliability contract for the marketplace.
# 99.9% over 30 days = 43.2 minutes of downtime budget per month.
resource "datadog_service_level_objective" "checkout_availability" {
  name = "[PrintForge] Checkout Availability"
  type = "metric"

  query {
    numerator   = "sum:http_requests_total{service:order-service,!status_code:5*}.as_count()"
    denominator = "sum:http_requests_total{service:order-service}.as_count()"
  }

  thresholds {
    timeframe = "30d"
    target    = 99.9
    warning   = 99.95
  }

  thresholds {
    timeframe = "7d"
    target    = 99.9
    warning   = 99.95
  }

  description = <<-EOT
    Measures the percentage of non-5xx responses from the checkout path.

    Target: 99.9% over 30 days = 43.2 minutes of downtime budget per month.

    SLI: (total checkout requests - 5xx responses) / total checkout requests

    Owner: Platform/DevOps Team
    Escalation: #platform-alerts Slack + PagerDuty on 50% budget burn
  EOT

  tags = ["service:order-service", "team:devops", "env:production", "slo-tier:1"]
}

# ─── Product Page Latency SLO — 99% under 300ms ─────────
# Product page latency drives conversion. We measure the request
# success rate against a 300ms p99 bucket from the histogram.
resource "datadog_service_level_objective" "product_latency" {
  name = "[PrintForge] Product Page Latency"
  type = "metric"

  query {
    numerator   = "sum:http_request_duration_seconds.count{service:product-service,le:0.3}.as_count()"
    denominator = "sum:http_request_duration_seconds.count{service:product-service}.as_count()"
  }

  thresholds {
    timeframe = "30d"
    target    = 99.0
    warning   = 99.5
  }

  description = <<-EOT
    Measures the percentage of product-service requests completing within 300ms.

    Target: 99% of requests under 300ms over 30 days.

    SLI: requests with duration <= 300ms / total requests

    Owner: Platform/DevOps Team
  EOT

  tags = ["service:product-service", "team:devops", "env:production", "slo-tier:1"]
}

# ─── Search Latency SLO — 95% under 200ms ───────────────
resource "datadog_service_level_objective" "search_latency" {
  name = "[PrintForge] Search Latency"
  type = "metric"

  query {
    numerator   = "sum:http_request_duration_seconds.count{service:search-service,le:0.2}.as_count()"
    denominator = "sum:http_request_duration_seconds.count{service:search-service}.as_count()"
  }

  thresholds {
    timeframe = "30d"
    target    = 95.0
    warning   = 97.0
  }

  description = <<-EOT
    Measures search response time. Target: 95% of searches complete within 200ms.

    Search is latency-sensitive — slow searches directly impact product discovery and conversion.
  EOT

  tags = ["service:search-service", "team:devops", "env:production", "slo-tier:2"]
}

# ─── Order Success Rate SLO — 99.95% ────────────────────
# Business SLI — sourced from the checkout_attempts_total counter in
# order-service/src/middleware/metrics.js. Directly correlates with revenue.
resource "datadog_service_level_objective" "order_success" {
  name = "[PrintForge] Order Success Rate"
  type = "metric"

  query {
    numerator   = "sum:checkout_attempts_total{service:order-service,status:success}.as_count()"
    denominator = "sum:checkout_attempts_total{service:order-service}.as_count()"
  }

  thresholds {
    timeframe = "30d"
    target    = 99.95
    warning   = 99.97
  }

  description = <<-EOT
    Measures successful order completion rate. Target: 99.95% over 30 days.

    This is a business-critical SLO — failed orders directly impact revenue
    and artist earnings.

    Budget: ~21.6 failed orders per month (at ~43,200 orders/month).
  EOT

  tags = ["service:order-service", "team:devops", "env:production", "business-critical:true", "slo-tier:1"]
}
