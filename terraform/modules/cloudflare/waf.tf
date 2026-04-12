# ─── WAF Rules ────────────────────────────────────────────

# Rate limiting — API endpoints
resource "cloudflare_ruleset" "rate_limit" {
  zone_id = var.zone_id
  name    = "Rate Limiting Rules"
  kind    = "zone"
  phase   = "http_ratelimit"

  # General API rate limit: 100 requests per minute
  rules {
    action = "block"
    ratelimit {
      characteristics     = ["ip.src"]
      period              = 60
      requests_per_period = 100
      mitigation_timeout  = 60
    }
    expression  = "(starts_with(http.request.uri.path, \"/api/\") and not starts_with(http.request.uri.path, \"/api/v1/products\"))"
    description = "Rate limit API (100 req/min per IP)"
    enabled     = true
  }

  # Strict rate limit on order creation: 10 requests per minute
  rules {
    action = "block"
    ratelimit {
      characteristics     = ["ip.src"]
      period              = 60
      requests_per_period = 10
      mitigation_timeout  = 120
    }
    expression  = "(http.request.uri.path eq \"/api/v1/orders\" and http.request.method eq \"POST\")"
    description = "Strict rate limit on order creation (10 req/min per IP)"
    enabled     = true
  }
}

# WAF managed rules — OWASP Core Ruleset
resource "cloudflare_ruleset" "waf" {
  zone_id = var.zone_id
  name    = "WAF Managed Rules"
  kind    = "zone"
  phase   = "http_request_firewall_managed"

  # Cloudflare Managed Ruleset (includes OWASP)
  rules {
    action = "execute"
    action_parameters {
      id = "efb7b8c949ac4650a09736fc376e9aee" # Cloudflare Managed Ruleset
    }
    expression  = "true"
    description = "Execute Cloudflare Managed Ruleset"
    enabled     = true
  }

  # OWASP Core Ruleset
  rules {
    action = "execute"
    action_parameters {
      id = "4814384a9e5d4991b9815dcfc25d2f1f" # OWASP Core Ruleset
    }
    expression  = "true"
    description = "Execute OWASP Core Ruleset"
    enabled     = true
  }
}

# Bot management
resource "cloudflare_ruleset" "bot_management" {
  zone_id = var.zone_id
  name    = "Bot Management"
  kind    = "zone"
  phase   = "http_request_firewall_custom"

  # Block definitely automated traffic on sensitive endpoints
  rules {
    action     = "block"
    expression = "(cf.bot_management.score lt 10 and http.request.uri.path eq \"/api/v1/orders\")"
    description = "Block bots on order endpoint"
    enabled     = true
  }

  # Challenge likely automated traffic on search
  rules {
    action     = "managed_challenge"
    expression = "(cf.bot_management.score lt 30 and starts_with(http.request.uri.path, \"/search\"))"
    description = "Challenge suspected bots on search"
    enabled     = true
  }
}
