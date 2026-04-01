/**
 * k6 Spike Test - Sudden Traffic Surge
 *
 * This test validates system behavior during sudden traffic spikes.
 *
 * Scenario: Sudden spike from 0 to 500 users, then back to 0
 * Purpose: Test auto-scaling, error handling, and recovery
 *
 * Run:
 * - k6 run tests/performance/spike-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const recoveryTime = new Trend('recovery_time');

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Baseline
    { duration: '1m', target: 500 },   // Spike! 0→500 rapidly
    { duration: '2m', target: 500 },   // Sustain spike
    { duration: '1m', target: 10 },    // Drop back down
    { duration: '30s', target: 0 },    // Recovery
  ],

  thresholds: {
    // Very lenient thresholds - we expect degradation during spike
    'http_req_duration': [
      'p(95)<3000',  // 95th percentile < 3s
      'p(99)<5000',  // 99th percentile < 5s
    ],
    'errors': ['rate<0.1'],  // Less than 10% error rate
    'http_req_failed': ['rate<0.1'],

    // Recovery metrics
    'recovery_time': ['p(95)<2000'],
  },

  tags: {
    test_type: 'spike',
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

let spikeStartTime;
let normalResponseTime;

export default function () {
  const startTime = Date.now();

  const health = http.get(`${BASE_URL}/health`);

  const responseTime = Date.now() - startTime;

  // Track normal response times before spike
  if (__VU <= 10 && !spikeStartTime) {
    normalResponseTime = responseTime;
  }

  // Detect spike phase
  if (__VU > 100 && !spikeStartTime) {
    spikeStartTime = Date.now();
  }

  // Measure recovery time after spike
  if (spikeStartTime && __VU <= 10) {
    if (responseTime <= normalResponseTime * 1.5) {
      recoveryTime.add(Date.now() - spikeStartTime);
      spikeStartTime = null; // Reset
    }
  }

  const success = check(health, {
    'status is 200': (r) => r.status === 200,
    'response time acceptable': () => responseTime < 5000,
  });

  errorRate.add(!success);

  // Minimal sleep during spike
  sleep(0.5);
}

export function setup() {
  console.log('⚡ Starting spike test...');
  console.log('Spike: 0 → 500 users in 1 minute');
  console.log('⚠️  Expect temporary performance degradation');
  console.log('🎯 Goal: System should recover without crashes');
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`✅ Spike test completed in ${duration.toFixed(1)}s`);
  console.log('📊 Check recovery_time metric for auto-scaling effectiveness');
}
