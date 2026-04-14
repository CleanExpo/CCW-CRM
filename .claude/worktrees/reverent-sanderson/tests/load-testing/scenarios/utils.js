/**
 * Load Testing Utilities
 *
 * Common functions used across test scenarios
 */

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
export const errorRate = new Rate('errors');
export const responseTime = new Trend('response_time');
export const requestCounter = new Counter('requests');

/**
 * Authenticate and get JWT token
 */
export function authenticate(baseUrl, email, password) {
  const loginRes = http.post(
    `${baseUrl}/api/auth/login`,
    JSON.stringify({
      email: email,
      password: password,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'auth', operation: 'write' },
    }
  );

  const success = check(loginRes, {
    'login successful': (r) => r.status === 200,
    'token received': (r) => r.json('access_token') !== undefined,
  });

  errorRate.add(!success);
  responseTime.add(loginRes.timings.duration);
  requestCounter.add(1);

  if (success) {
    const token = loginRes.json('access_token');
    return token;
  }

  console.error(`Authentication failed: ${loginRes.status} - ${loginRes.body}`);
  return null;
}

/**
 * Create authenticated headers
 */
export function createAuthHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Make authenticated GET request
 */
export function authenticatedGet(url, token, tags = {}) {
  const res = http.get(url, {
    headers: createAuthHeaders(token),
    tags: { operation: 'read', ...tags },
  });

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
  });

  errorRate.add(!success);
  responseTime.add(res.timings.duration);
  requestCounter.add(1);

  return res;
}

/**
 * Make authenticated POST request
 */
export function authenticatedPost(url, token, body, tags = {}) {
  const res = http.post(url, JSON.stringify(body), {
    headers: createAuthHeaders(token),
    tags: { operation: 'write', ...tags },
  });

  const success = check(res, {
    'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
  });

  errorRate.add(!success);
  responseTime.add(res.timings.duration);
  requestCounter.add(1);

  return res;
}

/**
 * Make authenticated PUT request
 */
export function authenticatedPut(url, token, body, tags = {}) {
  const res = http.put(url, JSON.stringify(body), {
    headers: createAuthHeaders(token),
    tags: { operation: 'write', ...tags },
  });

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
  });

  errorRate.add(!success);
  responseTime.add(res.timings.duration);
  requestCounter.add(1);

  return res;
}

/**
 * Make authenticated DELETE request
 */
export function authenticatedDelete(url, token, tags = {}) {
  const res = http.del(url, null, {
    headers: createAuthHeaders(token),
    tags: { operation: 'write', ...tags },
  });

  const success = check(res, {
    'status is 200 or 204': (r) => r.status === 200 || r.status === 204,
  });

  errorRate.add(!success);
  responseTime.add(res.timings.duration);
  requestCounter.add(1);

  return res;
}

/**
 * Generate random integer between min and max (inclusive)
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate random string
 */
export function randomString(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate random email
 */
export function randomEmail() {
  return `test.${randomString(8)}@loadtest.com`;
}

/**
 * Generate random SKU
 */
export function randomSKU() {
  return `SKU-${randomString(6).toUpperCase()}-${randomInt(100, 999)}`;
}

/**
 * Pick random item from array
 */
export function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Think time - simulate user reading/thinking
 */
export function thinkTime(min = 1, max = 3) {
  sleep(randomInt(min, max));
}

/**
 * Check health endpoint
 */
export function checkHealth(baseUrl) {
  const res = http.get(`${baseUrl}/health`, {
    tags: { endpoint: 'health', operation: 'read' },
  });

  const success = check(res, {
    'health check passed': (r) => r.status === 200,
    'health status is healthy': (r) => {
      try {
        return r.json('status') === 'healthy';
      } catch (e) {
        return false;
      }
    },
  });

  errorRate.add(!success);
  responseTime.add(res.timings.duration);
  requestCounter.add(1);

  return res;
}

/**
 * Common test data
 */
export const testData = {
  categories: [
    'heavy_machinery',
    'hand_tools',
    'power_tools',
    'safety_equipment',
    'building_materials',
    'electrical',
    'plumbing',
    'accessories',
  ],

  orderStatuses: [
    'draft',
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
  ],

  quoteStatuses: ['draft', 'pending', 'sent', 'accepted', 'rejected', 'expired'],

  countries: ['Australia', 'New Zealand', 'United States', 'United Kingdom'],

  states: ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'],
};

/**
 * Generate test product
 */
export function generateTestProduct() {
  return {
    sku: randomSKU(),
    name: `Test Product ${randomString(8)}`,
    description: `Load test product ${randomString(20)}`,
    category: randomChoice(testData.categories),
    price: randomInt(10, 1000),
    cost: randomInt(5, 500),
    stock: randomInt(0, 100),
    warehouse_location: `A${randomInt(1, 10)}-${randomInt(1, 20)}`,
    is_active: true,
  };
}

/**
 * Generate test customer
 */
export function generateTestCustomer() {
  return {
    customer_number: `CUST-${randomString(6).toUpperCase()}`,
    company_name: `Test Company ${randomString(8)}`,
    contact_name: `Test Contact ${randomString(10)}`,
    email: randomEmail(),
    phone: `+61${randomInt(400000000, 499999999)}`,
    address: `${randomInt(1, 999)} Test Street`,
    city: randomChoice(['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide']),
    state: randomChoice(testData.states),
    postal_code: `${randomInt(2000, 6999)}`,
    country: 'Australia',
    is_active: true,
  };
}

/**
 * Generate test order item
 */
export function generateOrderItem(productId) {
  const quantity = randomInt(1, 10);
  const unitPrice = randomInt(10, 500);
  return {
    product_id: productId,
    quantity: quantity,
    unit_price: unitPrice,
    subtotal: quantity * unitPrice,
  };
}

/**
 * Validate response structure
 */
export function validateResponse(res, expectedStatus, requiredFields = []) {
  const checks = {
    [`status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
  };

  // Add checks for required fields
  if (requiredFields.length > 0) {
    checks['response has required fields'] = (r) => {
      try {
        const data = r.json();
        return requiredFields.every((field) => field in data);
      } catch (e) {
        return false;
      }
    };
  }

  const success = check(res, checks);
  errorRate.add(!success);

  return success;
}

/**
 * Log test results
 */
export function logTestResult(testName, success, details = '') {
  const status = success ? '[OK]' : '[FAIL]';
  console.log(`${status} ${testName}: ${details}`);
}
