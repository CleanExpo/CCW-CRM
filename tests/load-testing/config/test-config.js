/**
 * k6 Load Testing Configuration
 *
 * UNI-481: Backend Load Testing (100 scenarios)
 *
 * Test Stages:
 * 1. Warmup: Gradual ramp-up to identify immediate issues
 * 2. Normal Load: Simulate typical usage patterns
 * 3. Peak Load: Test system under stress
 * 4. Spike Test: Sudden traffic surge
 * 5. Soak Test: Extended duration for memory leaks
 * 6. Stress Test: Push to breaking point
 */

export const testConfig = {
  // Base URL for API (change for staging/production)
  baseUrl: __ENV.API_URL || 'http://localhost:8000',

  // Test credentials
  auth: {
    email: __ENV.TEST_USER_EMAIL || 'admin@demo.com',
    password: __ENV.TEST_USER_PASSWORD || 'demo123',
  },

  // Performance thresholds
  thresholds: {
    // 95% of requests should complete within 500ms
    'http_req_duration': ['p(95)<500'],

    // 99% of requests should complete within 1000ms
    'http_req_duration{type:api}': ['p(99)<1000'],

    // Error rate should be less than 1%
    'http_req_failed': ['rate<0.01'],

    // 95% of authentication requests should complete within 300ms
    'http_req_duration{endpoint:auth}': ['p(95)<300'],

    // 95% of read operations should complete within 200ms
    'http_req_duration{operation:read}': ['p(95)<200'],

    // 95% of write operations should complete within 500ms
    'http_req_duration{operation:write}': ['p(95)<500'],

    // Database query operations
    'http_req_duration{operation:query}': ['p(95)<300'],

    // AI/ML operations (can be slower)
    'http_req_duration{operation:ai}': ['p(95)<2000'],

    // Minimum requests per second
    'http_reqs': ['rate>10'],
  },

  // Load test scenarios
  scenarios: {
    // Scenario 1: Baseline - Single VU for 1 minute
    baseline: {
      executor: 'constant-vus',
      vus: 1,
      duration: '1m',
      tags: { scenario: 'baseline' },
    },

    // Scenario 2: Smoke Test - Light load to verify basic functionality
    smoke: {
      executor: 'constant-vus',
      vus: 5,
      duration: '2m',
      tags: { scenario: 'smoke' },
    },

    // Scenario 3: Load Test - Normal usage pattern
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 10 },  // Ramp up to 10 users
        { duration: '5m', target: 10 },  // Stay at 10 users
        { duration: '2m', target: 20 },  // Ramp up to 20 users
        { duration: '5m', target: 20 },  // Stay at 20 users
        { duration: '2m', target: 0 },   // Ramp down
      ],
      tags: { scenario: 'load' },
    },

    // Scenario 4: Stress Test - Push system to limits
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 },  // Ramp up to 20
        { duration: '5m', target: 20 },  // Stay at 20
        { duration: '2m', target: 50 },  // Ramp up to 50
        { duration: '5m', target: 50 },  // Stay at 50
        { duration: '2m', target: 100 }, // Ramp up to 100
        { duration: '5m', target: 100 }, // Stay at 100
        { duration: '2m', target: 0 },   // Ramp down
      ],
      tags: { scenario: 'stress' },
    },

    // Scenario 5: Spike Test - Sudden traffic surge
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },   // Normal load
        { duration: '30s', target: 100 }, // Sudden spike
        { duration: '1m', target: 100 },  // Maintain spike
        { duration: '30s', target: 10 },  // Return to normal
        { duration: '1m', target: 10 },   // Normal load
        { duration: '1m', target: 0 },    // Ramp down
      ],
      tags: { scenario: 'spike' },
    },

    // Scenario 6: Soak Test - Extended duration for stability
    soak: {
      executor: 'constant-vus',
      vus: 15,
      duration: '30m',
      tags: { scenario: 'soak' },
    },
  },

  // Test data ranges
  testData: {
    // Product IDs range
    productIdRange: { min: 1, max: 100 },

    // Customer IDs range
    customerIdRange: { min: 1, max: 50 },

    // Order quantities
    quantityRange: { min: 1, max: 10 },

    // Price range
    priceRange: { min: 10, max: 1000 },
  },

  // Request timeouts
  timeouts: {
    default: '30s',
    ai: '60s',
    upload: '120s',
  },
};

// Export for use in test scenarios
export default testConfig;
