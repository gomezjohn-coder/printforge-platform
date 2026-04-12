const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const { SearchEngine } = require('./search-engine');

const app = express();
const PORT = process.env.PORT || 3002;
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3001';

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// X-Request-ID propagation
app.use((req, _res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  next();
});

// ---------------------------------------------------------------------------
// Search engine instance
// ---------------------------------------------------------------------------
const searchEngine = new SearchEngine(PRODUCT_SERVICE_URL);

// Pre-load the catalog on startup
searchEngine.loadCatalog().catch((err) => {
  console.warn('[search-service] Could not pre-load catalog from product-service, using built-in demo data:', err.message);
});

// ---------------------------------------------------------------------------
// Health / readiness
// ---------------------------------------------------------------------------
const startTime = Date.now();
let isReady = true;

app.get('/healthz', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'search-service',
    uptime: `${Math.floor((Date.now() - startTime) / 1000)}s`,
  });
});

app.get('/readyz', (_req, res) => {
  if (!isReady) {
    return res.status(503).json({ status: 'not_ready' });
  }
  res.json({
    status: 'ready',
    service: 'search-service',
    indexed_products: searchEngine.getIndexSize(),
  });
});

// ---------------------------------------------------------------------------
// Search endpoint
// GET /search?q=cat&category=stickers&sort=popular&page=1&limit=20
// ---------------------------------------------------------------------------
app.get('/search', (req, res) => {
  const {
    q = '',
    category = '',
    sort = 'relevance',
    page = '1',
    limit = '20',
  } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const startMs = Date.now();
  const results = searchEngine.search(q, { category, sort });
  const durationMs = Date.now() - startMs;

  // Pagination
  const startIdx = (pageNum - 1) * limitNum;
  const paginatedResults = results.slice(startIdx, startIdx + limitNum);

  console.log(
    `[search] q="${q}" category="${category}" sort="${sort}" results=${results.length} duration=${durationMs}ms request_id=${req.requestId}`
  );

  res.json({
    query: q,
    category: category || null,
    sort,
    total: results.length,
    page: pageNum,
    limit: limitNum,
    duration_ms: durationMs,
    results: paginatedResults,
  });
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
const server = app.listen(PORT, () => {
  console.log(`[search-service] listening on port ${PORT}`);
});

function shutdown(signal) {
  console.log(`[search-service] ${signal} received, shutting down gracefully`);
  isReady = false;

  server.close(() => {
    console.log('[search-service] HTTP server closed');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('[search-service] forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
