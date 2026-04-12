/**
 * PrintForge — Black Friday Spike Test
 *
 * Simulates a Black Friday sale: baseline 100 VUs jumps to 300 VUs (3x load)
 * for 5 minutes, then recovers. This is the load-test harness that the
 * Checkout Availability SLO (99.9%) and Product Page Latency SLO (< 300ms)
 * are exercised against.
 *
 * The scenario mixes a realistic user journey:
 *   70% browse — GET product-service /api/v1/products
 *   20% search — GET search-service via product-service proxy
 *   10% checkout — POST order-service /api/v1/checkout
 *
 * Goals:
 *   - Validate HPA responsiveness (order-service 3 → 9+ replicas)
 *   - Confirm rate-limiting returns 429 instead of 500
 *   - Verify p99 checkout latency stays under 500ms SLO
 *   - Verify no cascading failure into product-service
 *   - Measure error budget burn during the spike window
 *
 * Usage:
 *   k6 run monitoring/k6/spike.js
 *   k6 run -e PRODUCT_URL=https://api.printforge.io \
 *          -e ORDER_URL=https://checkout.printforge.io \
 *          monitoring/k6/spike.js
 *
 * Interpreting results:
 *   - `checkout_success_rate` < 99.9% → Checkout Availability SLO breached
 *   - `checkout_p99` > 500ms → Checkout Latency SLO breached
 *   - `server_errors_5xx` > 0 → cascading failure; investigate circuit breaker
 *   - `rate_limited_429` > 0 → expected and healthy under spike
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const errorRate = new Rate("errors");
const serverErrors = new Counter("server_errors_5xx");
const rateLimited = new Counter("rate_limited_429");
const checkoutSuccess = new Rate("checkout_success_rate");
const checkoutLatency = new Trend("checkout_p99", true);
const productLatency = new Trend("product_page_latency", true);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const PRODUCT_URL = __ENV.PRODUCT_URL || "http://localhost:3001";
const ORDER_URL = __ENV.ORDER_URL || "http://localhost:3003";

// Black Friday scenario: baseline 100 → peak 300 VUs (3x load)
export const options = {
  stages: [
    // Warm-up: baseline traffic (100 VUs) for 2 minutes
    { duration: "2m", target: 100 },

    // SPIKE: ramp to 300 VUs (3x) in 30 seconds
    { duration: "30s", target: 300 },

    // Hold the 3x spike for 5 minutes — this is where HPA has to catch up
    { duration: "5m", target: 300 },

    // Ramp back to baseline — verify scale-down stabilisation window
    { duration: "1m", target: 100 },

    // Cool-down observation period
    { duration: "2m", target: 100 },

    // Graceful ramp down
    { duration: "30s", target: 0 },
  ],

  thresholds: {
    // SLO-aligned thresholds — the test fails if any of these breach
    "checkout_success_rate": ["rate>0.999"],   // 99.9% Checkout Availability
    "checkout_p99": ["p(99)<500"],              // 500ms p99 latency SLO
    "product_page_latency": ["p(99)<300"],      // 300ms Product Page SLO
    "server_errors_5xx": ["count<10"],
    "http_req_failed": ["rate<0.01"],
  },

  tags: {
    test_type: "spike",
    scenario: "black-friday",
    project: "printforge",
  },

  batch: 50,
  batchPerHost: 50,
};

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------
const SEARCH_QUERIES = [
  "dragon t-shirt",
  "minimalist poster",
  "phone case abstract",
  "sticker pack retro",
  "hoodie vintage",
  "mug watercolor",
  "laptop sleeve geometric",
  "tote bag nature",
];

const SAMPLE_PRODUCT_IDS = [
  "prod_tee_001",
  "prod_phone_002",
  "prod_mug_003",
  "prod_hoodie_004",
  "prod_poster_005",
];

function headers() {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "k6-printforge-blackfriday-spike/1.0",
  };
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildCart() {
  const itemCount = 1 + Math.floor(Math.random() * 3); // 1-3 items
  const cart = [];
  for (let i = 0; i < itemCount; i++) {
    cart.push({
      product_id: pick(SAMPLE_PRODUCT_IDS),
      quantity: 1 + Math.floor(Math.random() * 2),
    });
  }
  return cart;
}

// ---------------------------------------------------------------------------
// Scenario — realistic user journey mix
// ---------------------------------------------------------------------------
export default function () {
  const roll = Math.random();

  if (roll < 0.7) {
    // ── 70% Browse catalog (product-service) ──────────────────────────
    group("browse: GET /api/v1/products", () => {
      const page = 1 + Math.floor(Math.random() * 10);
      const res = http.get(
        `${PRODUCT_URL}/api/v1/products?page=${page}&limit=20`,
        { headers: headers(), tags: { endpoint: "products", service: "product-service" } }
      );
      productLatency.add(res.timings.duration);

      if (res.status === 429) rateLimited.add(1);
      if (res.status >= 500) serverErrors.add(1);

      const ok = check(res, {
        "products: responded": (r) => r.status > 0,
        "products: no 5xx": (r) => r.status < 500,
        "products: 2xx or 429": (r) =>
          (r.status >= 200 && r.status < 300) || r.status === 429,
      });
      errorRate.add(!ok);
    });
  } else if (roll < 0.9) {
    // ── 20% Search ────────────────────────────────────────────────────
    group("search: GET /api/v1/products/search", () => {
      const query = pick(SEARCH_QUERIES);
      const res = http.get(
        `${PRODUCT_URL}/api/v1/products/search?q=${encodeURIComponent(query)}&limit=10`,
        { headers: headers(), tags: { endpoint: "search", service: "product-service" } }
      );
      productLatency.add(res.timings.duration);

      if (res.status === 429) rateLimited.add(1);
      if (res.status >= 500) serverErrors.add(1);

      const ok = check(res, {
        "search: responded": (r) => r.status > 0,
        "search: no 5xx": (r) => r.status < 500,
      });
      errorRate.add(!ok);
    });
  } else {
    // ── 10% Checkout — the SLO-bound critical path ────────────────────
    group("checkout: POST /api/v1/checkout", () => {
      const body = JSON.stringify({
        cart: buildCart(),
        payment: { method: "card", token: "tok_k6_synthetic" },
        shipping: { country: "AU", postcode: "3000" },
      });

      const res = http.post(`${ORDER_URL}/api/v1/checkout`, body, {
        headers: headers(),
        tags: { endpoint: "checkout", service: "order-service" },
        timeout: "10s",
      });
      checkoutLatency.add(res.timings.duration);

      if (res.status === 429) rateLimited.add(1);
      if (res.status >= 500) serverErrors.add(1);

      const success =
        res.status >= 200 && res.status < 300;
      checkoutSuccess.add(success);

      const ok = check(res, {
        "checkout: responded": (r) => r.status > 0,
        "checkout: no 5xx": (r) => r.status < 500,
        "checkout: 2xx or 429": (r) =>
          (r.status >= 200 && r.status < 300) || r.status === 429,
      });
      errorRate.add(!ok);
    });
  }

  // Small think time — simulate real user behavior
  sleep(Math.random() * 0.3);
}

// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------
export function setup() {
  console.log("============================================");
  console.log("PrintForge — Black Friday Spike Test");
  console.log("============================================");
  console.log(`Product service: ${PRODUCT_URL}`);
  console.log(`Order service:   ${ORDER_URL}`);

  const productHealth = http.get(`${PRODUCT_URL}/healthz`);
  if (productHealth.status !== 200) {
    throw new Error(
      `product-service ${PRODUCT_URL} not healthy (${productHealth.status}). Aborting.`
    );
  }
  const orderHealth = http.get(`${ORDER_URL}/healthz`);
  if (orderHealth.status !== 200) {
    throw new Error(
      `order-service ${ORDER_URL} not healthy (${orderHealth.status}). Aborting.`
    );
  }
  console.log("Both services healthy. Starting 3x spike (100 → 300 VUs).");
  return { startTime: new Date().toISOString() };
}

export function teardown(data) {
  console.log("============================================");
  console.log(`Spike test completed. Started: ${data.startTime}`);
  console.log("============================================");
  console.log("Review:");
  console.log("  - checkout_success_rate >= 99.9% → SLO held");
  console.log("  - checkout_p99 < 500ms           → latency SLO held");
  console.log("  - server_errors_5xx == 0         → no cascading failure");
  console.log("  - HPA scaled order-service from 3 → 9+ replicas");
}
