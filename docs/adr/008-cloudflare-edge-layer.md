# ADR-008: Cloudflare as Unified Edge Layer

**Status**: Accepted
**Date**: 2024-02-20
**Deciders**: Platform Engineering Team, Security Lead
**Context Area**: Edge Infrastructure, CDN, Security

## Context

PrintForge serves a global customer base with product images, artist storefronts, and a checkout flow that must be fast and resilient. The platform faces several edge-layer challenges:

- **Latency**: Product images and storefront pages must load quickly worldwide. Origin servers are in us-west-2; users in Europe and Asia experience 200-400ms of network latency
- **DDoS and bot traffic**: Print-on-demand marketplaces attract scraping bots (design theft), credential stuffing, and inventory manipulation bots
- **WAF**: The application needs protection against OWASP Top 10 vulnerabilities at the edge before traffic reaches the origin
- **DNS management**: Multiple subdomains (api.printforge.io, cdn.printforge.io, artists.printforge.io) need reliable, low-latency DNS
- **TLS management**: Certificate issuance and renewal for all subdomains

Managing these concerns across separate vendors (Route 53 for DNS, AWS CloudFront for CDN, AWS WAF, separate bot management) creates operational fragmentation and makes it difficult to correlate security events.

## Decision

Use **Cloudflare** as the unified edge layer for CDN, WAF, DNS, DDoS protection, and bot management.

### Architecture

```
User Request
    |
    v
Cloudflare Edge (nearest PoP)
    |-- DNS resolution (Cloudflare DNS)
    |-- TLS termination (Cloudflare-managed certs)
    |-- WAF rules (OWASP Core Ruleset + custom rules)
    |-- Bot management (challenge suspicious traffic)
    |-- CDN cache (static assets, product images)
    |
    v (cache miss or dynamic request)
AWS ALB (us-west-2)
    |
    v
EKS / ECS Services
```

### CDN Configuration

| Content Type | Cache TTL | Cache Key | Purge Strategy |
|---|---|---|---|
| Product images | 30 days | URL + image variant | On artist re-upload (API purge) |
| Static assets (JS/CSS) | 1 year | URL (content-hashed filenames) | Deploy-time purge |
| Storefront HTML | 5 minutes | URL + cookie-free | TTL expiry |
| API responses | No cache | N/A | N/A |
| Artist profile images | 7 days | URL | On profile update (API purge) |

### WAF Rules

- **OWASP Core Ruleset**: Managed ruleset enabled in block mode for SQLi, XSS, RCE, LFI
- **Rate limiting**: 100 requests/10s per IP to API endpoints; 1000 requests/10s for static assets
- **Custom rules**: Block requests with suspicious user agents, oversized payloads (>10MB except upload endpoints), and known malicious IP ranges
- **API shield**: Schema validation for product-service endpoints to reject malformed requests at the edge

### Bot Management

- **Verified bots** (Googlebot, Bingbot): Allow with logging
- **Likely automated** (headless browsers, known bot signatures): Challenge with managed challenge page
- **Definitely automated** (matching bot fingerprints): Block
- **Custom bot rules**: Rate limit on add-to-cart endpoint (5 requests/minute per session) to prevent inventory manipulation

### DNS Configuration

- Cloudflare authoritative DNS for printforge.io
- DNSSEC enabled
- Proxied records (orange cloud) for all web-facing subdomains
- Unproxied records for internal services (mail, VPN)

## Consequences

### Positive

- **Single pane of glass**: DNS, CDN, WAF, and bot management are configured and monitored in one dashboard with correlated analytics
- **Global performance**: Cloudflare's 300+ PoPs reduce TTFB by 60-80% for non-US users via edge caching and Argo Smart Routing
- **DDoS protection**: Cloudflare absorbs volumetric DDoS attacks at the edge without impacting origin infrastructure. Unmetered DDoS mitigation included in the plan
- **Reduced origin load**: CDN caching offloads 70-80% of requests from the origin, reducing EKS/ECS compute costs
- **Simplified TLS**: Cloudflare manages certificate issuance, renewal, and edge termination. Origin uses Cloudflare Origin CA certificates for end-to-end encryption
- **Fast DNS propagation**: Cloudflare DNS propagates changes in seconds versus minutes for Route 53

### Negative

- **Vendor lock-in**: Cloudflare-specific features (Workers, custom rules syntax) create switching costs
- **Origin visibility**: Cloudflare terminates TLS at the edge; origin servers see Cloudflare IPs unless `CF-Connecting-IP` header is used correctly
- **Cache invalidation complexity**: Programmatic cache purging requires Cloudflare API calls in the deployment pipeline
- **Cost at scale**: Cloudflare Pro/Business plans have per-feature pricing that increases with traffic volume. Current cost: approximately $200/month
- **Debugging latency**: When troubleshooting, an extra hop (Cloudflare edge) can obscure whether issues are at the edge or origin

## Alternatives Considered

### AWS CloudFront + AWS WAF + Route 53
Use the AWS-native CDN and security stack. Rejected because:
- Three separate services to configure and monitor versus one
- AWS WAF rule management is less intuitive than Cloudflare's rule builder
- No integrated bot management (requires AWS Bot Control add-on at additional cost)
- CloudFront PoP coverage is smaller than Cloudflare's network

### Fastly
Use Fastly for CDN with VCL-based edge logic. Rejected because Fastly's strengths (VCL customization, real-time log streaming) are more relevant for media streaming workloads. For a marketplace with standard caching patterns, Cloudflare's managed ruleset approach is operationally simpler. Fastly also lacks integrated DNS and bot management.

### Akamai
Enterprise-grade CDN and security platform. Rejected due to cost (significantly higher than Cloudflare for our traffic volume) and complexity (Akamai's configuration model requires specialized expertise).

### No CDN, rely on ALB and application caching
Serve all traffic directly from the origin. Rejected because latency for non-US users would remain high, origin infrastructure costs would scale linearly with traffic, and there would be no edge-layer DDoS protection.

## References

- Cloudflare documentation: WAF Managed Rules, Bot Management
- ADR-002: EKS for Microservices (origin infrastructure)
- ADR-005: Network Policy Default Deny (origin-level security complements edge WAF)
