/**
 * PrintForge — Stress Test
 *
 * Pushes the system beyond normal operating capacity to identify the
 * breaking point and observe degradation behavior. Ramps from 0 to 500
 * virtual users over 10 minutes, holds for 5 minutes, then ramps down.
 *
 * Goals:
 *   - Find the maximum throughput before errors spike
 *   - Verify HPA scaling behavior under heavy load
 *   - Confirm graceful degradation (no cascading failures)
 *   - Validate that the system recovers after load is removed
 *
 * Usage:
 *   k6 run monitoring/k6/stress.js
 *   k6 run -e BASE_URL=https://staging.printforge.io monitoring/k6/stress.js
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const errorRate = new Rate("errors");
const requestsPerSecond = new Counter("total_requests");
const p99Latency = new Trend("p99_latency", true);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";

export const options = {
  stages: [
    // Ramp up: 0 -> 500 VU over 10 minutes (gradual stress increase)
    { duration: "2m", target: 100 },
    { duration: "2m", target: 200 },
    { duration: "2m", target: 300 },
    { duration: "2m", target: 400 },
    { duration: "2m", target: 500 },

    // Hold at peak: 500 VU for 5 minutes
    { duration: "5m", target: 500 },

    // Ramp down: 500 -> 0 over 3 minutes (recovery observation)
    { duration: "1m", target: 250 },
    { duration: "1m", target: 100 },
    { duration: "1m", target: 0 },
  ],

  thresholds: {
    // Under stress, we allow degraded but not broken performance.
    // Error rate under 5% (SLO is 0.1% but stress tests push beyond SLO)
    errors: ["rate<0.05"],

    // P99 latency under 5s (normal SLO is 500ms, allow 10x under stress)
    http_req_duration: ["p(99)<5000", "p(95)<3000"],

    // Must maintain at least 50 req/s even under stress
    http_reqs: ["rate>50"],
  },

  tags: {
    test_type: "stress",
    project: "printforge",
  },
};

// ---------------------------------------------------------------------------
// Search query pool
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
  "wall art",
  "keychain",
  "board game insert",
  "sculpture",
  "bracket",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getHeaders() {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "k6-printforge-stress/1.0",
  };
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ---------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------
export default function () {
  const headers = getHeaders();

  // Weighted distribution: 50% products, 30% search, 20% categories
  const roll = Math.random();

  if (roll < 0.5) {
    // ── Products (heaviest traffic) ──────────────────────────────────
    group("stress: GET /api/v1/products", () => {
      const page = randomInt(1, 20);
      const limit = randomItem([10, 20, 50]);
      const res = http.get(
        `${BASE_URL}/api/v1/products?page=${page}&limit=${limit}`,
        { headers, tags: { endpoint: "products" } }
      );

      requestsPerSecond.add(1);
      p99Latency.add(res.timings.duration);

      const success = check(res, {
        "products: status is 2xx or 429": (r) =>
          (r.status >= 200 && r.status < 300) || r.status === 429,
        "products: no 5xx": (r) => r.status < 500,
      });

      errorRate.add(!success);
    });
  } else if (roll < 0.8) {
    // ── Search ───────────────────────────────────────────────────────
    group("stress: GET /api/v1/products/search", () => {
      const query = randomItem(SEARCH_QUERIES);
      const res = http.get(
        `${BASE_URL}/api/v1/products/search?q=${encodeURIComponent(query)}&limit=20`,
        { headers, tags: { endpoint: "search" } }
      );

      requestsPerSecond.add(1);
      p99Latency.add(res.timings.duration);

      const success = check(res, {
        "search: status is 2xx or 429": (r) =>
          (r.status >= 200 && r.status < 300) || r.status === 429,
        "search: no 5xx": (r) => r.status < 500,
      });

      errorRate.add(!success);
    });
  } else {
    // ── Categories ───────────────────────────────────────────────────
    group("stress: GET /api/v1/categories", () => {
      const res = http.get(`${BASE_URL}/api/v1/categories`, {
        headers,
        tags: { endpoint: "categories" },
      });

      requestsPerSecond.add(1);
      p99Latency.add(res.timings.duration);

      const success = check(res, {
        "categories: status is 2xx or 429": (r) =>
          (r.status >= 200 && r.status < 300) || r.status === 429,
        "categories: no 5xx": (r) => r.status < 500,
      });

      errorRate.add(!success);
    });
  }

  // Shorter sleep under stress to maximize throughput
  sleep(Math.random() * 0.5 + 0.1);
}

// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------
export function setup() {
  // Verify the target is reachable before running the full test
  const res = http.get(`${BASE_URL}/healthz`);
  if (res.status !== 200) {
    throw new Error(
      `Target ${BASE_URL} is not healthy (status: ${res.status}). ` +
        `Aborting stress test to avoid wasting resources.`
    );
  }
  console.log(`Target ${BASE_URL} is healthy. Starting stress test.`);
  return { startTime: new Date().toISOString() };
}

export function teardown(data) {
  console.log(`Stress test completed. Started at: ${data.startTime}`);
  console.log(
    "Review HPA scaling events: kubectl get events -n printforge --field-selector reason=SuccessfulRescale"
  );
}
