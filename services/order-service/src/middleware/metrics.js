const client = require('prom-client');

client.collectDefaultMetrics({
  labels: { service: 'order-service' },
});

// HTTP SLIs
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// Business SLIs — drives the Checkout Availability SLO
const checkoutCounter = new client.Counter({
  name: 'checkout_attempts_total',
  help: 'Total checkout attempts by outcome',
  labelNames: ['status'], // success | error | invalid
});

const checkoutDuration = new client.Histogram({
  name: 'checkout_duration_seconds',
  help: 'End-to-end checkout latency in seconds',
  labelNames: ['status'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
});

function metricsMiddleware(req, res, next) {
  if (req.path === '/metrics' || req.path === '/healthz' || req.path === '/readyz') {
    return next();
  }
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route ? `${req.baseUrl}${req.route.path}` : req.path;
    const labels = { method: req.method, route, status_code: res.statusCode };
    end(labels);
    httpRequestsTotal.inc(labels);
  });
  next();
}

module.exports = metricsMiddleware;
module.exports.checkoutCounter = checkoutCounter;
module.exports.checkoutDuration = checkoutDuration;
