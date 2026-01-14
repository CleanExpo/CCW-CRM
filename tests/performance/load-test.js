/**
 * k6 Load Test - Baseline Performance
 *
 * This test validates system performance under normal load conditions.
 *
 * Scenario: 100 virtual users over 5 minutes
 * Target: API endpoints for PRD generation workflow
 *
 * Installation:
 * - Download k6: https://k6.io/docs/get-started/installation/
 * - Windows: winget install k6 --source winget
 * - macOS: brew install k6
 * - Linux: See k6.io docs
 *
 * Run:
 * - k6 run tests/performance/load-test.js
 * - k6 run tests/performance/load-test.js --out json=results.json
 * - k6 run tests/performance/load-test.js --out influxdb=http://localhost:8086/k6
 *
 * Thresholds:
 * - p95 response time: < 500ms
 * - p99 response time: < 1000ms
 * - Error rate: < 1%
 * - Success rate: > 99%
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const successRate = new Rate('success');
const prdGenerationDuration = new Trend('prd_generation_duration');
const apiErrors = new Counter('api_errors');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 20 },   // Ramp up to 20 users
    { duration: '3m', target: 100 },  // Ramp up to 100 users
    { duration: '1m', target: 0 },    // Ramp down to 0 users
  ],

  thresholds: {
    // HTTP request duration thresholds
    'http_req_duration': [
      'p(95)<500',   // 95% of requests should be below 500ms
      'p(99)<1000',  // 99% of requests should be below 1000ms
    ],

    // Error rate threshold
    'errors': ['rate<0.01'],  // Error rate should be less than 1%

    // Success rate threshold
    'success': ['rate>0.99'], // Success rate should be greater than 99%

    // HTTP request failures
    'http_req_failed': ['rate<0.01'],

    // Custom metrics
    'prd_generation_duration': ['p(95)<2000'],
    'api_errors': ['count<10'],
  },

  // Test metadata
  tags: {
    test_type: 'load',
    environment: 'test',
  },
};

// Test configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const WEB_URL = __ENV.WEB_URL || 'http://localhost:3000';

// Test data
const testPRDRequest = {
  product_name: 'k6 Load Test Product',
  description: 'A product for load testing the PRD generation system',
  target_audience: 'Developers and QA Engineers',
  key_features: [
    'High performance under load',
    'Scalable architecture',
    'Reliable error handling',
  ],
};

export default function () {
  // Test 1: Health Check
  const healthCheck = http.get(`${BASE_URL}/health`);

  const healthCheckSuccess = check(healthCheck, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 200ms': (r) => r.timings.duration < 200,
  });

  errorRate.add(!healthCheckSuccess);
  successRate.add(healthCheckSuccess);

  sleep(1);

  // Test 2: PRD Generation Request
  const prdGenerationStart = Date.now();

  const prdGeneration = http.post(
    `${BASE_URL}/api/prd/generate`,
    JSON.stringify(testPRDRequest),
    {
      headers: {
        'Content-Type': 'application/json',
      },
      tags: { name: 'PRDGeneration' },
    }
  );

  const prdGenerationSuccess = check(prdGeneration, {
    'PRD generation status is 200 or 202': (r) => r.status === 200 || r.status === 202,
    'PRD generation returns run_id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.run_id !== undefined;
      } catch (e) {
        return false;
      }
    },
    'PRD generation response time < 1000ms': (r) => r.timings.duration < 1000,
  });

  errorRate.add(!prdGenerationSuccess);
  successRate.add(prdGenerationSuccess);

  if (!prdGenerationSuccess) {
    apiErrors.add(1);
  }

  // Extract run_id for status check
  let runId;
  try {
    const responseBody = JSON.parse(prdGeneration.body);
    runId = responseBody.run_id;
  } catch (e) {
    console.error('Failed to parse PRD generation response');
  }

  sleep(2);

  // Test 3: Check PRD Status
  if (runId) {
    const statusCheck = http.get(`${BASE_URL}/api/prd/status/${runId}`, {
      tags: { name: 'PRDStatus' },
    });

    const statusCheckSuccess = check(statusCheck, {
      'status check is 200 or 404': (r) => r.status === 200 || r.status === 404,
      'status check response time < 300ms': (r) => r.timings.duration < 300,
    });

    errorRate.add(!statusCheckSuccess);
    successRate.add(statusCheckSuccess);

    prdGenerationDuration.add(Date.now() - prdGenerationStart);
  }

  sleep(1);

  // Test 4: Homepage Load (Frontend)
  const homepage = http.get(WEB_URL, {
    tags: { name: 'Homepage' },
  });

  const homepageSuccess = check(homepage, {
    'homepage status is 200': (r) => r.status === 200,
    'homepage response time < 1000ms': (r) => r.timings.duration < 1000,
  });

  errorRate.add(!homepageSuccess);
  successRate.add(homepageSuccess);

  sleep(2);
}

/**
 * Setup function - runs once before the test
 */
export function setup() {
  console.log('Starting load test...');
  console.log(`Backend URL: ${BASE_URL}`);
  console.log(`Frontend URL: ${WEB_URL}`);

  // Verify services are running
  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error('Backend service is not healthy. Aborting test.');
  }

  console.log('Services are healthy. Beginning test...');
  return { startTime: new Date().toISOString() };
}

/**
 * Teardown function - runs once after the test
 */
export function teardown(data) {
  console.log('Load test completed!');
  console.log(`Test started at: ${data.startTime}`);
  console.log(`Test completed at: ${new Date().toISOString()}`);
}

/**
 * Expected Results:
 *
 * ✅ PASS Criteria:
 * - 95th percentile response time < 500ms
 * - 99th percentile response time < 1000ms
 * - Error rate < 1%
 * - Success rate > 99%
 * - No more than 10 API errors total
 *
 * 📊 Metrics to Monitor:
 * - http_req_duration (p95, p99, avg, max)
 * - http_req_failed (rate)
 * - errors (rate)
 * - success (rate)
 * - prd_generation_duration (p95)
 * - api_errors (count)
 *
 * 🔍 Troubleshooting:
 * - High response times: Check backend CPU/memory, database connections
 * - High error rates: Check logs for exceptions, validate API contracts
 * - Failed requests: Verify services are running, check network connectivity
 */
