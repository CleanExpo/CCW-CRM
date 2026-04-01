/**
 * k6 Baseline Test - Normal Load
 *
 * This test establishes baseline performance metrics under normal conditions.
 *
 * Scenario: 50 virtual users over 3 minutes
 * Purpose: Establish performance baseline for comparison
 *
 * Run:
 * - k6 run tests/performance/baseline-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Warm up to 10 users
    { duration: '2m', target: 50 },   // Stay at 50 users
    { duration: '30s', target: 0 },   // Ramp down
  ],

  thresholds: {
    'http_req_duration': ['p(95)<300', 'p(99)<500'],
    'errors': ['rate<0.005'],  // Less than 0.5% error rate
    'http_req_failed': ['rate<0.005'],
  },

  tags: {
    test_type: 'baseline',
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const WEB_URL = __ENV.WEB_URL || 'http://localhost:3000';

export default function () {
  // Health check
  const health = http.get(`${BASE_URL}/health`);
  check(health, {
    'health is 200': (r) => r.status === 200,
  });

  sleep(1);

  // PRD generation
  const prd = http.post(
    `${BASE_URL}/api/prd/generate`,
    JSON.stringify({
      product_name: 'Baseline Test Product',
      description: 'Testing baseline performance',
      target_audience: 'Users',
      key_features: ['Feature 1', 'Feature 2'],
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const success = check(prd, {
    'PRD generation successful': (r) => r.status === 200 || r.status === 202,
  });

  errorRate.add(!success);

  sleep(2);

  // Homepage
  http.get(WEB_URL);

  sleep(2);
}

export function setup() {
  console.log('🎯 Starting baseline performance test...');
  console.log('Target: 50 concurrent users for 2 minutes');
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`✅ Baseline test completed in ${duration.toFixed(1)}s`);
}
