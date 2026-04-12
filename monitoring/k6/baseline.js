/**
 * PrintForge — Baseline Load Test
 *
 * Simulates normal production traffic patterns with 50 virtual users
 * over 5 minutes. Validates that core endpoints meet SLO thresholds
 * under expected load.
 *
 * Endpoints tested:
 *   - GET /api/v1/products       (product catalog browsing)
 *   - GET /api/v1/products/search (search with query parameter)
 *   - GET /api/v1/categories     (category listing)
 *
 * Usage:
 *   k6 run monitoring/k6/baseline.js
 *   k6 run --out json=results.json monitoring/k6/baseline.js
 *   k6 run -e BASE_URL=https://staging.printforge.io monitoring/k6/baseline.js
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const errorRate = new Rate("errors");
const productLatency = new Trend("product_latency", true);
const searchLatency = new Trend("search_latency", true);
const categoryLatency = new Trend("category_latency", true);
const requestCount = new Counter("total_requests");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";

export const options = {
  stages: [
    { duration: "30s", target: 50 },  // ramp up to 50 VU over 30s
    { duration: "4m", target: 50 },   // hold at 50 VU for 4 minutes
    { duration: "30s", target: 0 },   // ramp down over 30s
  ],

  thresholds: {
    // SLO-001: 99.9% of requests must succeed
    errors: ["rate<0.001"],

    // SLO-002: P99 latency under 500ms for API
    http_req_duration: ["p(99)<500", "p(95)<300", "p(50)<100"],

    // Per-endpoint latency thresholds
    product_latency: ["p(99)<500", "p(95)<250"],
    search_latency: ["p(99)<200", "p(95)<100"],
    category_latency: ["p(99)<300", "p(95)<150"],

    // Throughput: at least 10 req/s
    http_reqs: ["rate>10"],
  },

  // Tag results for Datadog/Grafana integration
  tags: {
    test_type: "baseline",
    project: "printforge",
  },
};

// ---------------------------------------------------------------------------
// Search query pool — simulates realistic user search behavior
// ---------------------------------------------------------------------------
const SEARCH_QUERIES = [
  "dragon figurine",
  "miniature",
  "terrain",
  "dice tower",
  "cosplay helmet",
  "vase",
  "phone stand",
  "lithophane",
  "articulated",
  "planter",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getHeaders() {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "k6-printforge-baseline/1.0",
  };
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------
export default function () {
  const headers = getHeaders();

  // ── Products ─────────────────────────────────────────────────────────
  group("GET /api/v1/products", () => {
    const page = Math.floor(Math.random() * 5) + 1;
    const res = http.get(
      `${BASE_URL}/api/v1/products?page=${page}&limit=20`,
      { headers, tags: { endpoint: "products" } }
    );

    requestCount.add(1);
    productLatency.add(res.timings.duration);

    const success = check(res, {
      "products: status 200": (r) => r.status === 200,
      "products: has body": (r) => r.body && r.body.length > 0,
      "products: response time < 500ms": (r) => r.timings.duration < 500,
      "products: valid JSON": (r) => {
        try {
          JSON.parse(r.body);
          return true;
        } catch (e) {
          return false;
        }
      },
    });

    errorRate.add(!success);
  });

  sleep(1);

  // ── Search ───────────────────────────────────────────────────────────
  group("GET /api/v1/products/search", () => {
    const query = randomItem(SEARCH_QUERIES);
    const res = http.get(
      `${BASE_URL}/api/v1/products/search?q=${encodeURIComponent(query)}&limit=20`,
      { headers, tags: { endpoint: "search" } }
    );

    requestCount.add(1);
    searchLatency.add(res.timings.duration);

    const success = check(res, {
      "search: status 200": (r) => r.status === 200,
      "search: has body": (r) => r.body && r.body.length > 0,
      "search: response time < 200ms": (r) => r.timings.duration < 200,
      "search: valid JSON": (r) => {
        try {
          JSON.parse(r.body);
          return true;
        } catch (e) {
          return false;
        }
      },
    });

    errorRate.add(!success);
  });

  sleep(1);

  // ── Categories ───────────────────────────────────────────────────────
  group("GET /api/v1/categories", () => {
    const res = http.get(`${BASE_URL}/api/v1/categories`, {
      headers,
      tags: { endpoint: "categories" },
    });

    requestCount.add(1);
    categoryLatency.add(res.timings.duration);

    const success = check(res, {
      "categories: status 200": (r) => r.status === 200,
      "categories: has body": (r) => r.body && r.body.length > 0,
      "categories: response time < 300ms": (r) => r.timings.duration < 300,
      "categories: valid JSON": (r) => {
        try {
          JSON.parse(r.body);
          return true;
        } catch (e) {
          return false;
        }
      },
    });

    errorRate.add(!success);
  });

  sleep(1);
}
