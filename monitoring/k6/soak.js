/**
 * PrintForge — Soak Test
 *
 * Applies moderate, sustained load (100 VUs for 30 minutes) to detect
 * issues that only surface over time:
 *   - Memory leaks (Node.js heap growth, Go goroutine leaks)
 *   - Connection pool exhaustion (PostgreSQL, Redis)
 *   - File descriptor leaks
 *   - Gradual latency degradation (GC pressure, cache eviction)
 *   - Log volume / disk pressure
 *
 * Usage:
 *   k6 run monitoring/k6/soak.js
 *   k6 run -e BASE_URL=https://staging.printforge.io monitoring/k6/soak.js
 *
 * Pair with:
 *   - `kubectl top pods -n printforge --containers` (memory trend)
 *   - Datadog Memory Utilization dashboard
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// ---------------------------------------------------------------------------
// Custom metrics — track trends over time for leak detection
// ---------------------------------------------------------------------------
const errorRate = new Rate("errors");
const requestCount = new Counter("total_requests");
const latencyTrend = new Trend("response_latency", true);

// Per-phase latency tracking to detect gradual degradation
const earlyLatency = new Trend("early_phase_latency", true);   // first 10 min
const midLatency = new Trend("mid_phase_latency", true);       // middle 10 min
const lateLatency = new Trend("late_phase_latency", true);     // final 10 min

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";
const SOAK_DURATION = __ENV.SOAK_DURATION || "30m";

// Track test start time for phase bucketing
let testStartTime;

export const options = {
  stages: [
    { duration: "1m", target: 100 },    // ramp up to 100 VU
    { duration: SOAK_DURATION, target: 100 },  // hold at 100 VU for 30 minutes
    { duration: "1m", target: 0 },      // ramp down
  ],

  thresholds: {
    // SLO thresholds — must hold steady over the entire soak period
    errors: ["rate<0.001"],
    http_req_duration: ["p(99)<500", "p(95)<300"],

    // Memory leak detection: late-phase latency should not be significantly
    // worse than early-phase latency. A 2x increase suggests a leak.
    early_phase_latency: ["p(95)<300"],
    late_phase_latency: ["p(95)<600"],

    // Must maintain request throughput over the entire test
    http_reqs: ["rate>10"],
  },

  tags: {
    test_type: "soak",
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
  "cookie cutter",
  "pen holder",
  "chess set",
  "lamp shade",
  "cable organizer",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getHeaders() {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "k6-printforge-soak/1.0",
  };
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getPhase() {
  const elapsed = (Date.now() - testStartTime) / 1000 / 60; // minutes
  if (elapsed < 10) return "early";
  if (elapsed < 20) return "mid";
  return "late";
}

function recordPhaseLatency(duration) {
  const phase = getPhase();
  if (phase === "early") earlyLatency.add(duration);
  else if (phase === "mid") midLatency.add(duration);
  else lateLatency.add(duration);
}

// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------
export function setup() {
  const res = http.get(`${BASE_URL}/healthz`);
  if (res.status !== 200) {
    throw new Error(
      `Target ${BASE_URL} is not healthy (status: ${res.status}). Aborting soak test.`
    );
  }

  const startTime = Date.now();
  console.log(`Target ${BASE_URL} is healthy. Starting soak test.`);
  console.log(`Soak duration: ${SOAK_DURATION} at 100 VUs.`);
  console.log(
    "Monitor memory usage during the test:"
  );
  console.log(
    "  kubectl top pods -n printforge --containers --sort-by=memory"
  );

  return { startTime };
}

export function teardown(data) {
  const durationMin = ((Date.now() - data.startTime) / 1000 / 60).toFixed(1);
  console.log(`Soak test completed. Total duration: ${durationMin} minutes.`);
  console.log("");
  console.log("Post-soak checklist:");
  console.log("  1. Compare early_phase_latency vs late_phase_latency P95");
  console.log("     - If late is >2x early, investigate memory leaks");
  console.log("  2. Check pod memory usage trend in Datadog");
  console.log("  3. Review PostgreSQL connection count (should be stable)");
  console.log("  4. Check Redis memory usage (should not grow unbounded)");
  console.log("  5. Review container restart count (should be 0)");
}

// ---------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------
export default function (data) {
  // Initialize test start time from setup data
  if (!testStartTime) {
    testStartTime = data.startTime;
  }

  const headers = getHeaders();

  // Simulate realistic browsing patterns
  const scenario = Math.random();

  if (scenario < 0.35) {
    // ── Browse products (35%) ──────────────────────────────────────
    group("soak: browse products", () => {
      const page = Math.floor(Math.random() * 10) + 1;
      const res = http.get(
        `${BASE_URL}/api/v1/products?page=${page}&limit=20`,
        { headers, tags: { endpoint: "products" } }
      );

      requestCount.add(1);
      latencyTrend.add(res.timings.duration);
      recordPhaseLatency(res.timings.duration);

      const success = check(res, {
        "products: status 200": (r) => r.status === 200,
        "products: valid JSON": (r) => {
          try {
            JSON.parse(r.body);
            return true;
          } catch (e) {
            return false;
          }
        },
        "products: latency < 500ms": (r) => r.timings.duration < 500,
      });

      errorRate.add(!success);
    });
  } else if (scenario < 0.6) {
    // ── Search (25%) ─────────────────────────────────────────────
    group("soak: search", () => {
      const query = randomItem(SEARCH_QUERIES);
      const res = http.get(
        `${BASE_URL}/api/v1/products/search?q=${encodeURIComponent(query)}&limit=20`,
        { headers, tags: { endpoint: "search" } }
      );

      requestCount.add(1);
      latencyTrend.add(res.timings.duration);
      recordPhaseLatency(res.timings.duration);

      const success = check(res, {
        "search: status 200": (r) => r.status === 200,
        "search: latency < 200ms": (r) => r.timings.duration < 200,
      });

      errorRate.add(!success);
    });
  } else if (scenario < 0.8) {
    // ── Categories (20%) ──────────────────────────────────────────
    group("soak: categories", () => {
      const res = http.get(`${BASE_URL}/api/v1/categories`, {
        headers,
        tags: { endpoint: "categories" },
      });

      requestCount.add(1);
      latencyTrend.add(res.timings.duration);
      recordPhaseLatency(res.timings.duration);

      const success = check(res, {
        "categories: status 200": (r) => r.status === 200,
        "categories: latency < 300ms": (r) => r.timings.duration < 300,
      });

      errorRate.add(!success);
    });
  } else {
    // ── Full user journey (20%) ─────────────────────────────────
    // Simulates: browse -> search -> view product -> check categories
    group("soak: user journey", () => {
      // Step 1: Browse products
      const browseRes = http.get(
        `${BASE_URL}/api/v1/products?page=1&limit=20`,
        { headers, tags: { endpoint: "products" } }
      );
      requestCount.add(1);
      latencyTrend.add(browseRes.timings.duration);
      recordPhaseLatency(browseRes.timings.duration);

      check(browseRes, {
        "journey: browse 200": (r) => r.status === 200,
      });

      sleep(0.5);

      // Step 2: Search
      const query = randomItem(SEARCH_QUERIES);
      const searchRes = http.get(
        `${BASE_URL}/api/v1/products/search?q=${encodeURIComponent(query)}&limit=10`,
        { headers, tags: { endpoint: "search" } }
      );
      requestCount.add(1);
      latencyTrend.add(searchRes.timings.duration);
      recordPhaseLatency(searchRes.timings.duration);

      check(searchRes, {
        "journey: search 200": (r) => r.status === 200,
      });

      sleep(0.5);

      // Step 3: Get categories
      const catRes = http.get(`${BASE_URL}/api/v1/categories`, {
        headers,
        tags: { endpoint: "categories" },
      });
      requestCount.add(1);
      latencyTrend.add(catRes.timings.duration);
      recordPhaseLatency(catRes.timings.duration);

      const success = check(catRes, {
        "journey: categories 200": (r) => r.status === 200,
      });

      errorRate.add(!success);
    });
  }

  // Realistic think time between actions
  sleep(Math.random() * 2 + 1);
}
