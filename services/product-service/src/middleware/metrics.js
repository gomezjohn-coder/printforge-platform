const client = require('prom-client');

// Collect default metrics (CPU, memory, event loop lag, etc.)
client.collectDefaultMetrics({
  labels: { service: 'product-service' },
});

// HTTP request duration histogram — the core SLI for latency SLOs
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

// HTTP request counter — the core SLI for availability SLOs
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// Active connections gauge
const activeConnections = new client.Gauge({
  name: 'http_active_connections',
  help: 'Number of active HTTP connections',
});

// Order counter — business metric for SLO
const ordersTotal = new client.Counter({
  name: 'orders_total',
  help: 'Total number of orders placed',
  labelNames: ['status'],
});

function metricsMiddleware(req, res, next) {
  // Skip metrics and health endpoints
  if (req.path === '/metrics' || req.path === '/healthz' || req.path === '/readyz') {
    return next();
  }

  activeConnections.inc();
  const end = httpRequestDuration.startTimer();

  res.on('finish', () => {
    const route = req.route ? `${req.baseUrl}${req.route.path}` : req.path;
    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode,
    };

    end(labels);
    httpRequestsTotal.inc(labels);
    activeConnections.dec();
  });

  next();
}

module.exports = metricsMiddleware;
module.exports.ordersTotal = ordersTotal;
