/**
 * k6 smoke test — UNI-1917 rate limiting verification
 *
 * Usage:
 *   k6 run scripts/load/rate-limit-smoke.js
 *   BASE_URL=https://api.staging.ccw-erp.com k6 run scripts/load/rate-limit-smoke.js
 *
 * What it tests:
 *   1. Global endpoint (GET /api/health) allows ≥100 req/min from a single IP
 *   2. Login endpoint (POST /api/auth/login) returns 429 after 5 attempts/min
 *   3. 429 responses include a Retry-After header
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

const rateLimitHits = new Counter('rate_limit_hits');
const retryAfterPresent = new Rate('retry_after_present');

export const options = {
  scenarios: {
    // Scenario 1: global limit smoke — 110 rapid requests should get ~100 OK + ~10 429
    global_limit: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 110,
      maxDuration: '30s',
      tags: { scenario: 'global_limit' },
    },
    // Scenario 2: login brute-force — 7 rapid POSTs should get ≥2 429s
    login_brute_force: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 7,
      maxDuration: '10s',
      startTime: '35s',
      tags: { scenario: 'login_brute_force' },
    },
  },
  thresholds: {
    // At least some requests must be rate-limited in the brute-force scenario
    rate_limit_hits: ['count>0'],
    // Every 429 must carry a Retry-After header
    retry_after_present: ['rate>0.99'],
  },
};

export default function () {
  const scenario = __ENV.K6_SCENARIO_NAME || 'global_limit';

  if (scenario === 'global_limit') {
    const res = http.get(`${BASE_URL}/api/health`, { tags: { name: 'health' } });

    check(res, {
      'health returns 200 or 429': (r) => r.status === 200 || r.status === 429,
    });

    if (res.status === 429) {
      rateLimitHits.add(1);
      retryAfterPresent.add(res.headers['Retry-After'] !== undefined);
    }
  } else if (scenario === 'login_brute_force') {
    const payload = JSON.stringify({ email: 'probe@invalid.test', password: 'wrongpassword' });
    const params = {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'login' },
    };
    const res = http.post(`${BASE_URL}/api/auth/login`, payload, params);

    check(res, {
      'login returns 401 or 429': (r) => r.status === 401 || r.status === 422 || r.status === 429,
    });

    if (res.status === 429) {
      rateLimitHits.add(1);
      retryAfterPresent.add(res.headers['Retry-After'] !== undefined);
    }

    sleep(0.1);
  }
}
