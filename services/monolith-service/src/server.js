/**
 * PrintForge Legacy Monolith
 *
 * This is the ORIGINAL monolithic application that predates the microservices
 * migration. It still handles admin dashboards, reporting, and some order
 * management that hasn't been fully migrated yet.
 *
 * Runs on AWS ECS Fargate (NOT Kubernetes).
 *
 * TODO(migration): Extract order-management into its own service
 * TODO(migration): Move reporting to the analytics pipeline
 * TODO(tech-debt): Replace EJS with a proper frontend framework
 * TODO(tech-debt): body-parser is built into express 4.16+, remove dep
 */

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser'); // TODO: remove, use express.json()
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 4000;

// ---------------------------------------------------------------------------
// Template engine (server-side rendering -- legacy pattern)
// ---------------------------------------------------------------------------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(morgan('combined'));
app.use(bodyParser.json());         // TODO: switch to express.json()
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// ---------------------------------------------------------------------------
// Fake "database" -- in production this hits a PostgreSQL RDS instance
// ---------------------------------------------------------------------------
const MOCK_DB = {
  orders: [
    { id: 'ORD-10231', customer: 'john.doe@gmail.com', total: 47.98, status: 'shipped', items: 3, created_at: '2026-03-28' },
    { id: 'ORD-10232', customer: 'sarah.k@outlook.com', total: 124.50, status: 'processing', items: 5, created_at: '2026-03-29' },
    { id: 'ORD-10233', customer: 'mike.chen@yahoo.com', total: 19.99, status: 'delivered', items: 1, created_at: '2026-03-30' },
    { id: 'ORD-10234', customer: 'emma.w@gmail.com', total: 89.97, status: 'processing', items: 4, created_at: '2026-04-01' },
    { id: 'ORD-10235', customer: 'alex.j@proton.me', total: 34.98, status: 'pending', items: 2, created_at: '2026-04-02' },
    { id: 'ORD-10236', customer: 'lisa.m@icloud.com', total: 249.95, status: 'shipped', items: 8, created_at: '2026-04-03' },
  ],
  products: {
    total: 1247,
    active: 1102,
    draft: 89,
    archived: 56,
  },
  artists: {
    total: 342,
    verified: 287,
    pending_verification: 55,
  },
  revenue: {
    today: 2847.50,
    this_week: 18_432.75,
    this_month: 67_891.20,
    last_month: 72_345.80,
  },
};

// ---------------------------------------------------------------------------
// Health check (ECS uses this)
// ---------------------------------------------------------------------------
app.get('/healthz', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'monolith-service',
    version: '2.14.3',
    uptime: process.uptime(),
    // NOTE: In a real legacy app you'd see things like DB connection checks here
  });
});

// ---------------------------------------------------------------------------
// Admin dashboard (server-side rendered)
// ---------------------------------------------------------------------------
app.get('/admin', (_req, res) => {
  const recentOrders = MOCK_DB.orders.slice(-5).reverse();
  const ordersByStatus = {
    pending: MOCK_DB.orders.filter(o => o.status === 'pending').length,
    processing: MOCK_DB.orders.filter(o => o.status === 'processing').length,
    shipped: MOCK_DB.orders.filter(o => o.status === 'shipped').length,
    delivered: MOCK_DB.orders.filter(o => o.status === 'delivered').length,
  };

  res.render('admin', {
    title: 'PrintForge Admin Dashboard',
    stats: {
      products: MOCK_DB.products,
      artists: MOCK_DB.artists,
      revenue: MOCK_DB.revenue,
      ordersByStatus,
    },
    recentOrders,
  });
});

// ---------------------------------------------------------------------------
// API routes (legacy -- some are proxied from the API gateway)
// ---------------------------------------------------------------------------
app.get('/admin/api/orders', (_req, res) => {
  res.json({ orders: MOCK_DB.orders, total: MOCK_DB.orders.length });
});

app.get('/admin/api/stats', (_req, res) => {
  res.json({
    products: MOCK_DB.products,
    artists: MOCK_DB.artists,
    revenue: MOCK_DB.revenue,
  });
});

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({ error: 'not found', service: 'monolith-service' });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const server = app.listen(PORT, () => {
  console.log(`[monolith-service] listening on port ${PORT}`);
  console.log(`[monolith-service] admin dashboard: http://localhost:${PORT}/admin`);
});

// Graceful shutdown for ECS SIGTERM
process.on('SIGTERM', () => {
  console.log('[monolith-service] SIGTERM received, draining connections...');
  server.close(() => {
    console.log('[monolith-service] server closed');
    process.exit(0);
  });
});
