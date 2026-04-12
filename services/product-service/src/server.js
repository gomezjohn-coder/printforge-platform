const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const pinoHttp = require('pino-http');
const { v4: uuidv4 } = require('uuid');
const { register: metricsRegistry } = require('prom-client');
const logger = require('./middleware/logger');
const metricsMiddleware = require('./middleware/metrics');
const { sequelize } = require('./models');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const artistRoutes = require('./routes/artists');
const categoryRoutes = require('./routes/categories');

const app = express();
const PORT = process.env.PORT || 3001;
const SERVICE_NAME = 'product-service';

// ─── Middleware ───────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// Request ID propagation — critical for distributed tracing
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('x-request-id', req.id);
  next();
});

// Structured HTTP logging
app.use(pinoHttp({
  logger,
  genReqId: (req) => req.id,
  customProps: (req) => ({ service: SERVICE_NAME }),
}));

// Prometheus metrics collection
app.use(metricsMiddleware);

// ─── Health Checks ───────────────────────────────────────
// Liveness: is the process alive?
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', service: SERVICE_NAME, timestamp: new Date().toISOString() });
});

// Readiness: can the service handle traffic?
app.get('/readyz', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({ status: 'ready', database: 'connected' });
  } catch (err) {
    logger.error({ err }, 'Readiness check failed');
    res.status(503).json({ status: 'not ready', database: 'disconnected' });
  }
});

// Prometheus metrics endpoint (scraped by Datadog agent)
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', metricsRegistry.contentType);
    res.end(await metricsRegistry.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

// ─── API Routes ──────────────────────────────────────────
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/artists', artistRoutes);
app.use('/api/v1/categories', categoryRoutes);

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
const SHUTDOWN_TIMEOUT = 30000; // 30s — matches K8s terminationGracePeriodSeconds

async function startServer() {
  try {
    await sequelize.sync();
    logger.info('Database synchronized');

    // Auto-seed in development
    if (process.env.NODE_ENV !== 'production') {
      const { seedDatabase } = require('./seed');
      await seedDatabase();
    }

    server = app.listen(PORT, () => {
      logger.info({ port: PORT }, `${SERVICE_NAME} started`);
    });
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

async function shutdown(signal) {
  logger.info({ signal }, 'Shutdown signal received, draining connections...');

  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Wait for in-flight requests to complete
  const shutdownTimer = setTimeout(() => {
    logger.warn('Shutdown timeout exceeded, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  try {
    await sequelize.close();
    logger.info('Database connections closed');
    clearTimeout(shutdownTimer);
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    clearTimeout(shutdownTimer);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer();

module.exports = app; // For testing
