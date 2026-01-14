// Load Test Configuration
// Update these values for your environment

export const config = {
  // Target URLs
  baseUrl: __ENV.BASE_URL || 'https://api.your-domain.com',
  frontendUrl: __ENV.FRONTEND_URL || 'https://your-domain.com',

  // Authentication
  testUser: {
    email: __ENV.TEST_USER_EMAIL || 'test@example.com',
    password: __ENV.TEST_USER_PASSWORD || 'testpassword',
  },

  // Performance Thresholds
  thresholds: {
    // HTTP request duration
    http_req_duration_p95: 1000, // 95% of requests should be below 1s
    http_req_duration_p99: 2000, // 99% of requests should be below 2s

    // HTTP request failure rate
    http_req_failed_rate: 0.01, // Less than 1% of requests should fail

    // Specific endpoints (ms)
    health_duration: 100, // Health checks should be < 100ms
    list_duration: 500, // List endpoints should be < 500ms
    detail_duration: 300, // Detail endpoints should be < 300ms
    create_duration: 1000, // Create operations should be < 1000ms
  },

  // Test Data
  testData: {
    productIds: [1, 2, 3, 4, 5], // Sample product IDs for testing
    customerIds: [1, 2, 3], // Sample customer IDs
    orderIds: [1, 2, 3, 4, 5], // Sample order IDs
  },

  // Think time (seconds) - time users spend "reading" between actions
  thinkTime: {
    min: 2,
    max: 5,
  },
};

// Helper function to get random item from array
export function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Helper function to think time (pause between actions)
export function think() {
  const min = config.thinkTime.min;
  const max = config.thinkTime.max;
  return Math.random() * (max - min) + min;
}
