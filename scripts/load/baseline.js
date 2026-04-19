/**
 * k6 baseline load test — UNI-1919
 *
 * Measures p50/p95/p99 latency for the three highest-traffic API routes
 * across three VU stages (10 → 50 → 100), 5 minutes each.
 *
 * Usage:
 *   # Against local dev stack (default)
 *   k6 run scripts/load/baseline.js
 *
 *   # Against staging
 *   BASE_URL=https://api.staging.ccw-erp.com \
 *     AUTH_EMAIL=admin@demo.com AUTH_PASSWORD=demo123 \
 *     k6 run scripts/load/baseline.js
 *
 *   # Save JSON summary for docs/perf/
 *   k6 run --summary-export docs/perf/baseline-summary.json scripts/load/baseline.js
 *
 * Expected duration: ~15 minutes (3 stages × 5 min)
 * Required: k6 v0.46+ (https://k6.io/docs/get-started/installation/)
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const AUTH_EMAIL = __ENV.AUTH_EMAIL || 'admin@demo.com';
const AUTH_PASSWORD = __ENV.AUTH_PASSWORD || 'demo123';

// Per-endpoint latency trends for clean per-route reporting
const dashboardDuration = new Trend('dashboard_duration', true);
const ordersDuration = new Trend('orders_duration', true);
const quotesDuration = new Trend('quotes_duration', true);

const errorRate = new Rate('errors');
const authFailures = new Counter('auth_failures');

// ---------------------------------------------------------------------------
// Test stages: ramp 10 → 50 → 100 VUs, 5 minutes each
// ---------------------------------------------------------------------------

export const options = {
  stages: [
    { duration: '1m', target: 10 }, // ramp to 10 VUs
    { duration: '4m', target: 10 }, // hold at 10
    { duration: '1m', target: 50 }, // ramp to 50 VUs
    { duration: '4m', target: 50 }, // hold at 50
    { duration: '1m', target: 100 }, // ramp to 100 VUs
    { duration: '4m', target: 100 }, // hold at 100
    { duration: '1m', target: 0 }, // ramp down
  ],
  thresholds: {
    // Overall: p95 under 500ms at any stage
    http_req_duration: ['p(95)<500'],
    // Per-endpoint: p95 under 500ms
    dashboard_duration: ['p(95)<500'],
    orders_duration: ['p(95)<500'],
    quotes_duration: ['p(95)<500'],
    // Error rate under 1%
    errors: ['rate<0.01'],
    // All HTTP calls must succeed or rate-limit (429) — no 5xx
    http_req_failed: ['rate<0.01'],
  },
  // Tag per-endpoint requests so the JSON summary is readable
  tags: { test: 'baseline-2026-04', project: 'ccw-erp' },
};

// ---------------------------------------------------------------------------
// Setup: authenticate once, share token across VUs
// ---------------------------------------------------------------------------

export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: AUTH_EMAIL, password: AUTH_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (loginRes.status !== 200) {
    authFailures.add(1);
    console.error(`Auth failed: ${loginRes.status} — ${loginRes.body}`);
    return { token: null };
  }

  const body = JSON.parse(loginRes.body);
  return { token: body.access_token };
}

// ---------------------------------------------------------------------------
// Default function: runs once per VU per iteration
// ---------------------------------------------------------------------------

export default function (data) {
  if (!data.token) {
    authFailures.add(1);
    sleep(1);
    return;
  }

  const headers = {
    Authorization: `Bearer ${data.token}`,
    Accept: 'application/json',
  };

  // --- /api/dashboard ---
  group('dashboard', () => {
    const res = http.get(`${BASE_URL}/api/dashboard/metrics`, {
      headers,
      tags: { endpoint: 'dashboard' },
    });

    const ok = check(res, {
      'dashboard 200': (r) => r.status === 200,
      'dashboard not 5xx': (r) => r.status < 500,
    });
    if (!ok) errorRate.add(1);
    dashboardDuration.add(res.timings.duration);
  });

  sleep(0.5);

  // --- /api/orders ---
  group('orders', () => {
    const res = http.get(`${BASE_URL}/api/orders?page=1&page_size=20`, {
      headers,
      tags: { endpoint: 'orders' },
    });

    const ok = check(res, {
      'orders 200': (r) => r.status === 200,
      'orders not 5xx': (r) => r.status < 500,
    });
    if (!ok) errorRate.add(1);
    ordersDuration.add(res.timings.duration);
  });

  sleep(0.5);

  // --- /api/quotes ---
  group('quotes', () => {
    const res = http.get(`${BASE_URL}/api/quotes?page=1&page_size=20`, {
      headers,
      tags: { endpoint: 'quotes' },
    });

    const ok = check(res, {
      'quotes 200': (r) => r.status === 200,
      'quotes not 5xx': (r) => r.status < 500,
    });
    if (!ok) errorRate.add(1);
    quotesDuration.add(res.timings.duration);
  });

  sleep(1);
}

// ---------------------------------------------------------------------------
// Teardown: log summary hint
// ---------------------------------------------------------------------------

export function teardown() {
  console.log('');
  console.log('Baseline run complete.');
  console.log(
    'Export full JSON: k6 run --summary-export docs/perf/baseline-summary.json scripts/load/baseline.js'
  );
}
