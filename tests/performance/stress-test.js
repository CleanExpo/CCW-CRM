/**
 * k6 Stress Test - High Load
 *
 * This test validates system behavior under stress conditions.
 *
 * Scenario: Gradually increase load to 200 users over 10 minutes
 * Purpose: Find system breaking point and performance degradation
 *
 * Run:
 * - k6 run tests/performance/stress-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter } from 'k6/metrics';

const errorRate = new Rate('errors');
const timeouts = new Counter('timeouts');

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp to 50 users
    { duration: '3m', target: 100 },  // Ramp to 100 users
    { duration: '3m', target: 200 },  // Ramp to 200 users (stress)
    { duration: '2m', target: 0 },    // Ramp down
  ],

  thresholds: {
    // More lenient thresholds for stress test
    'http_req_duration': [
      'p(95)<1000',  // 95th percentile < 1s
      'p(99)<2000',  // 99th percentile < 2s
    ],
    'errors': ['rate<0.05'],  // Less than 5% error rate
    'http_req_failed': ['rate<0.05'],
    'timeouts': ['count<50'],  // No more than 50 timeouts
  },

  tags: {
    test_type: 'stress',
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

export default function () {
  const responses = http.batch([
    ['GET', `${BASE_URL}/health`],
    [
      'POST',
      `${BASE_URL}/api/prd/generate`,
      JSON.stringify({
        product_name: 'Stress Test Product',
        description: 'Testing under high load',
        target_audience: 'Load testers',
        key_features: ['Scalability', 'Performance'],
      }),
      { headers: { 'Content-Type': 'application/json' } },
    ],
  ]);

  responses.forEach((response) => {
    const success = check(response, {
      'status is success': (r) => r.status >= 200 && r.status < 300,
      'no timeout': (r) => r.timings.duration < 30000,
    });

    if (!success) {
      errorRate.add(1);
    }

    if (response.timings.duration >= 30000) {
      timeouts.add(1);
    }
  });

  sleep(1);
}

export function setup() {
  console.log('💪 Starting stress test...');
  console.log('Target: Ramp up to 200 concurrent users');
  console.log('Duration: 10 minutes');
  console.log('⚠️  This test will push the system to its limits');
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`✅ Stress test completed in ${duration.toFixed(1)}s`);
  console.log('📊 Review metrics to identify breaking points');
}
