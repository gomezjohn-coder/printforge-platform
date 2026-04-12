# Service Level Objectives

| Service         | SLO                       | Target  | Measurement                              |
| --------------- | ------------------------- | ------- | ---------------------------------------- |
| order-service   | Checkout availability     | 99.9%   | HTTP 2xx / total requests                |
| product-service | Page latency p95          | < 300ms | Response time histogram                  |
| artist-service  | Upload success rate       | 99.5%   | Successful S3 puts / attempts            |

## Error budgets

- **order-service**: 0.1% of requests may fail over a rolling 30-day window.
  If the budget is exhausted, new deploys are frozen until it recovers.
- **product-service**: p95 latency > 300ms for more than 5 minutes triggers a
  PagerDuty alert.

## Measurement

- SLIs are computed from Prometheus histograms scraped via ServiceMonitor.
- Grafana panels render burn-rate alerts on 1h and 6h windows.
