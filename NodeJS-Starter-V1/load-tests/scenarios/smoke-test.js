/**
 * Smoke Test
 *
 * Purpose: Verify that the system can handle minimal load
 * Duration: 1 minute
 * Users: 1-5 virtual users
 * When to run: After every deployment to verify basic functionality
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { config, randomItem, think } from '../config.js';

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 1 }, // Ramp up to 1 user
    { duration: '30s', target: 5 }, // Stay at 5 users
  ],
  thresholds: {
    http_req_duration: [`p(95)<${config.thresholds.http_req_duration_p95}`],
    http_req_failed: [`rate<${config.thresholds.http_req_failed_rate}`],
  },
};

let authToken = null;

// Setup function - runs once per VU
export function setup() {
  // Login to get auth token
  const loginRes = http.post(`${config.baseUrl}/api/auth/login`, JSON.stringify({
    email: config.testUser.email,
    password: config.testUser.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status === 200) {
    const token = loginRes.json('access_token');
    return { authToken: token };
  }

  console.error('Login failed in setup');
  return { authToken: null };
}

// Main test function
export default function (data) {
  const headers = data.authToken
    ? {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.authToken}`,
      }
    : { 'Content-Type': 'application/json' };

  // 1. Health Check
  const healthRes = http.get(`${config.baseUrl}/health`, { tags: { name: 'Health' } });
  check(healthRes, {
    'health check status 200': (r) => r.status === 200,
    'health check fast': (r) => r.timings.duration < config.thresholds.health_duration,
  });
  sleep(think());

  // 2. Get Products List
  const productsRes = http.get(`${config.baseUrl}/api/products`, {
    headers,
    tags: { name: 'Products List' },
  });
  check(productsRes, {
    'products list status 200': (r) => r.status === 200,
    'products list has data': (r) => r.json('items') !== undefined,
    'products list fast': (r) => r.timings.duration < config.thresholds.list_duration,
  });
  sleep(think());

  // 3. Get Single Product
  const productId = randomItem(config.testData.productIds);
  const productRes = http.get(`${config.baseUrl}/api/products/${productId}`, {
    headers,
    tags: { name: 'Product Detail' },
  });
  check(productRes, {
    'product detail status 200': (r) => r.status === 200,
    'product detail has id': (r) => r.json('id') !== undefined,
    'product detail fast': (r) => r.timings.duration < config.thresholds.detail_duration,
  });
  sleep(think());

  // 4. Get Customers List
  const customersRes = http.get(`${config.baseUrl}/api/customers`, {
    headers,
    tags: { name: 'Customers List' },
  });
  check(customersRes, {
    'customers list status 200': (r) => r.status === 200,
    'customers list fast': (r) => r.timings.duration < config.thresholds.list_duration,
  });
  sleep(think());

  // 5. Get Orders List
  const ordersRes = http.get(`${config.baseUrl}/api/orders`, {
    headers,
    tags: { name: 'Orders List' },
  });
  check(ordersRes, {
    'orders list status 200': (r) => r.status === 200,
    'orders list fast': (r) => r.timings.duration < config.thresholds.list_duration,
  });
  sleep(think());

  // 6. Get Dashboard Stats
  const dashboardRes = http.get(`${config.baseUrl}/api/dashboard/stats`, {
    headers,
    tags: { name: 'Dashboard' },
  });
  check(dashboardRes, {
    'dashboard status 200': (r) => r.status === 200,
    'dashboard has stats': (r) => r.json('orders') !== undefined,
  });
  sleep(think());

  // 7. Test AI Chat (optional)
  if (data.authToken) {
    const chatRes = http.post(
      `${config.baseUrl}/api/ai/chat`,
      JSON.stringify({
        message: 'What is the status of recent orders?',
        context: {},
      }),
      {
        headers,
        tags: { name: 'AI Chat' },
      }
    );
    check(chatRes, {
      'ai chat status 200': (r) => r.status === 200,
    });
  }
}

// Teardown function
export function teardown(data) {
  console.log('Smoke test completed');
}
