// ============================================================================
// order-service — checkout + order lifecycle
//
// Owns the checkout flow: cart validation against product-service, payment
// orchestration (stubbed), order persistence, and fulfilment handoff to the
// legacy monolith-service. This is the service behind the 99.9% Checkout
// Availability SLO and the < 500ms p99 latency SLO.
// ============================================================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const pinoHttp = require('pino-http');
const { v4: uuidv4 } = require('uuid');
const CircuitBreaker = require('opossum');
const { register: metricsRegistry } = require('prom-client');

const logger = require('./middleware/logger');
const metricsMiddleware = require('./middleware/metrics');
const { checkoutCounter, checkoutDuration } = require('./middleware/metrics');

const app = express();
const PORT = process.env.PORT || 3003;
const SERVICE_NAME = 'order-service';

const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3001';
const MONOLITH_SERVICE_URL = process.env.MONOLITH_SERVICE_URL || 'http://monolith-service:4000';
const CHECKOUT_TIMEOUT_MS = parseInt(process.env.CHECKOUT_TIMEOUT_MS || '5000', 10);

// ─── Middleware ────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: (process.env.CORS_ORIGINS || '').split(',').filter(Boolean) || true }));
app.use(compression());
app.use(express.json({ limit: '256kb' }));

// Request ID propagation — critical for distributed tracing
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('x-request-id', req.id);
  next();
});

app.use(pinoHttp({
  logger,
  genReqId: (req) => req.id,
  customProps: () => ({ service: SERVICE_NAME }),
}));

app.use(metricsMiddleware);

// ─── Circuit Breaker: product-service lookup ──────────────
// Prevents cascading failure if product-service degrades — a requirement of
// the Checkout Availability SLO. Falls back to cached pricing (stub).
async function fetchProduct(productId, reqId) {
  const res = await fetch(`${PRODUCT_SERVICE_URL}/api/v1/products/${productId}`, {
    headers: { 'x-request-id': reqId },
    signal: AbortSignal.timeout(CHECKOUT_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`product lookup failed: ${res.status}`);
  return res.json();
}

const productBreaker = new CircuitBreaker(fetchProduct, {
  timeout: CHECKOUT_TIMEOUT_MS,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  rollingCountTimeout: 10000,
});
productBreaker.fallback(() => ({ degraded: true, price_cents: null }));
productBreaker.on('open', () => logger.warn('product-service circuit breaker OPEN'));
productBreaker.on('halfOpen', () => logger.info('product-service circuit breaker HALF-OPEN'));
productBreaker.on('close', () => logger.info('product-service circuit breaker CLOSED'));

// ─── Health Checks ────────────────────────────────────────
app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
  });
});

app.get('/readyz', (req, res) => {
  // Readiness reflects downstream health. If the circuit breaker to
  // product-service is open, we can't complete checkouts, so we're not ready.
  if (productBreaker.opened) {
    return res.status(503).json({ status: 'not ready', reason: 'product-service unreachable' });
  }
  res.status(200).json({ status: 'ready' });
});

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', metricsRegistry.contentType);
    res.end(await metricsRegistry.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

// ─── Checkout API ─────────────────────────────────────────
// POST /api/v1/checkout — validate cart, charge payment, create order
app.post('/api/v1/checkout', async (req, res, next) => {
  const endTimer = checkoutDuration.startTimer();
  try {
    const { cart, payment, shipping } = req.body;
    if (!Array.isArray(cart) || cart.length === 0) {
      checkoutCounter.inc({ status: 'invalid' });
      endTimer({ status: 'invalid' });
      return res.status(400).json({ error: 'cart must be a non-empty array' });
    }

    // 1. Validate each product via circuit-broken call to product-service
    const products = await Promise.all(
      cart.map((item) => productBreaker.fire(item.product_id, req.id))
    );

    // 2. Compute total (falls back to cached pricing if degraded)
    const totalCents = products.reduce((sum, p, i) => {
      if (p.degraded || p.price_cents == null) return sum;
      return sum + p.price_cents * cart[i].quantity;
    }, 0);

    // 3. Charge payment (stubbed — real impl would call Stripe)
    const paymentId = `pay_${uuidv4()}`;

    // 4. Persist order (stubbed — real impl would write to Postgres)
    const orderId = `ord_${uuidv4()}`;
    logger.info({
      orderId, totalCents, paymentId, itemCount: cart.length, requestId: req.id,
    }, 'Order created');

    // 5. Fire-and-forget fulfilment handoff to legacy monolith-service
    fetch(`${MONOLITH_SERVICE_URL}/internal/fulfilment`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': req.id },
      body: JSON.stringify({ orderId, cart, shipping }),
      signal: AbortSignal.timeout(2000),
    }).catch((err) => logger.warn({ err, orderId }, 'monolith fulfilment handoff failed (async)'));

    checkoutCounter.inc({ status: 'success' });
    endTimer({ status: 'success' });
    res.status(201).json({ orderId, paymentId, totalCents, currency: 'USD' });
  } catch (err) {
    checkoutCounter.inc({ status: 'error' });
    endTimer({ status: 'error' });
    next(err);
  }
});

// GET /api/v1/orders/:id — retrieve an order (stub)
app.get('/api/v1/orders/:id', (req, res) => {
  res.status(200).json({
    orderId: req.params.id,
    status: 'processing',
    // Real impl: look up in Postgres
  });
});

// ─── Error Handler ───────────────────────────────────────
app.use((err, req, res, _next) => {
  logger.error({ err, requestId: req.id }, 'Unhandled error');
  res.status(err.status || 500).json({
    error: {
      message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
      requestId: req.id,
    },
  });
});

// ─── Graceful Shutdown ───────────────────────────────────
let server;
const SHUTDOWN_TIMEOUT = 30000; // Matches K8s terminationGracePeriodSeconds

function startServer() {
  server = app.listen(PORT, () => {
    logger.info({ port: PORT }, `${SERVICE_NAME} started`);
  });
}

function shutdown(signal) {
  logger.info({ signal }, 'Shutdown signal received, draining connections...');
  server.close(() => logger.info('HTTP server closed'));
  const timer = setTimeout(() => {
    logger.warn('Shutdown timeout exceeded, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);
  productBreaker.shutdown();
  clearTimeout(timer);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

if (require.main === module) {
  startServer();
}

module.exports = app;
