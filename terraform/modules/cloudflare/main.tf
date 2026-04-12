# ============================================================
# Cloudflare Module — Edge Layer (DNS, WAF, CDN)
# ============================================================
# See ADR-008: Cloudflare as Edge Layer
# ============================================================

terraform {
  required_version = ">= 1.5"
  required_providers {
    cloudflare = { source = "cloudflare/cloudflare"; version = "~> 4.0" }
  }
}

# ─── DNS Records ─────────────────────────────────────────
resource "cloudflare_record" "marketplace" {
  zone_id = var.zone_id
  name    = var.domain_name
  type    = "CNAME"
  content = var.alb_dns_name
  proxied = true
  ttl     = 1 # Auto when proxied
}

resource "cloudflare_record" "api" {
  zone_id = var.zone_id
  name    = "api.${var.domain_name}"
  type    = "CNAME"
  content = var.alb_dns_name
  proxied = true
  ttl     = 1
}

resource "cloudflare_record" "admin" {
  zone_id = var.zone_id
  name    = "admin.${var.domain_name}"
  type    = "CNAME"
  content = var.monolith_alb_dns_name
  proxied = true
  ttl     = 1
}

# ─── SSL/TLS — Full Strict Mode ──────────────────────────
resource "cloudflare_zone_settings_override" "tls" {
  zone_id = var.zone_id

  settings {
    ssl              = "strict"
    always_use_https = "on"
    min_tls_version  = "1.2"
    tls_1_3          = "on"
    automatic_https_rewrites = "on"
  }
}

# ─── Cache Rules ─────────────────────────────────────────
resource "cloudflare_ruleset" "cache" {
  zone_id = var.zone_id
  name    = "Cache Rules"
  kind    = "zone"
  phase   = "http_request_cache_settings"

  # Aggressive caching for static assets
  rules {
    action = "set_cache_settings"
    action_parameters {
      cache = true
      edge_ttl {
        mode    = "override_origin"
        default = 86400 # 24 hours
      }
      browser_ttl {
        mode    = "override_origin"
        default = 3600 # 1 hour
      }
    }
    expression  = "(http.request.uri.path matches \"\\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2|woff)$\")"
    description = "Cache static assets aggressively"
    enabled     = true
  }

  # No cache for API endpoints
  rules {
    action = "set_cache_settings"
    action_parameters {
      cache = false
    }
    expression  = "(starts_with(http.request.uri.path, \"/api/\"))"
    description = "Bypass cache for API routes"
    enabled     = true
  }
}
