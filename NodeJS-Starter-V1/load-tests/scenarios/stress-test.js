/**
 * Stress Test
 *
 * Purpose: Find the system's breaking point
 * Duration: 15 minutes
 * Users: Ramp from 0 to 200+ concurrent users
 * When to run: To determine maximum capacity and identify bottlenecks
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { config, randomItem, think } from '../config.js';
import { Rate, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Warm up
    { duration: '3m', target: 100 },  // Normal load
    { duration: '3m', target: 150 },  // Stress begins
    { duration: '3m', target: 200 },  // Push to limits
    { duration: '2m', target: 250 },  // Beyond breaking point
    { duration: '2m', target: 0 },    // Recovery
  ],
  thresholds: {
    // Relax thresholds for stress test
    'http_req_duration': [`p(95)<${config.thresholds.http_req_duration_p95 * 2}`],
    'http_req_duration': [`p(99)<${config.thresholds.http_req_duration_p99 * 2}`],
    // Allow higher error rate
    'http_req_failed': ['rate<0.2'], // Less than 20% failure is acceptable
    'errors': ['rate<0.3'], // Less than 30% errors is acceptable
  },
};

export function setup() {
  const loginRes = http.post(`${config.baseUrl}/api/auth/login`, JSON.stringify({
    email: config.testUser.email,
    password: config.testUser.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status === 200) {
    return { authToken: loginRes.json('access_token') };
  }

  return { authToken: null };
}

export default function (data) {
  const headers = data.authToken
    ? {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.authToken}`,
      }
    : { 'Content-Type': 'application/json' };

  // Aggressive user behavior - less think time
  const aggressiveThink = () => Math.random() * 1 + 0.5; // 0.5-1.5 seconds

  group('Stress Test - Mixed Load', () => {
    // 1. Multiple concurrent reads
    const batch = http.batch([
      ['GET', `${config.baseUrl}/api/products`, null, { headers }],
      ['GET', `${config.baseUrl}/api/customers`, null, { headers }],
      ['GET', `${config.baseUrl}/api/orders`, null, { headers }],
      ['GET', `${config.baseUrl}/api/quotes`, null, { headers }],
      ['GET', `${config.baseUrl}/api/dashboard/stats`, null, { headers }],
    ]);

    batch.forEach((res) => {
      const success = res.status === 200;
      if (success) {
        successfulRequests.add(1);
      } else {
        failedRequests.add(1);
      }
      errorRate.add(!success);
    });

    sleep(aggressiveThink());

    // 2. Write operations
    if (Math.random() < 0.5) {
      // 50% chance to create order
      const customerId = randomItem(config.testData.customerIds);
      const productId = randomItem(config.testData.productIds);

      const createOrderRes = http.post(
        `${config.baseUrl}/api/orders`,
        JSON.stringify({
          customer_id: customerId,
          items: [
            {
              product_id: productId,
              quantity: Math.floor(Math.random() * 3) + 1,
              unit_price: Math.floor(Math.random() * 500) + 50,
            },
          ],
        }),
        {
          headers,
          tags: { name: 'Create Order' },
        }
      );

      const success = check(createOrderRes, {
        'create order success': (r) => r.status === 201,
      });

      if (success) {
        successfulRequests.add(1);
      } else {
        failedRequests.add(1);
      }
      errorRate.add(!success);
    } else {
      // 50% chance to create quote
      const customerId = randomItem(config.testData.customerIds);
      const productId = randomItem(config.testData.productIds);

      const createQuoteRes = http.post(
        `${config.baseUrl}/api/quotes`,
        JSON.stringify({
          customer_id: customerId,
          items: [
            {
              product_id: productId,
              quantity: Math.floor(Math.random() * 5) + 1,
              unit_price: Math.floor(Math.random() * 500) + 50,
            },
          ],
        }),
        {
          headers,
          tags: { name: 'Create Quote' },
        }
      );

      const success = check(createQuoteRes, {
        'create quote success': (r) => r.status === 201,
      });

      if (success) {
        successfulRequests.add(1);
      } else {
        failedRequests.add(1);
      }
      errorRate.add(!success);
    }

    sleep(aggressiveThink());

    // 3. Detail views
    const detailBatch = http.batch([
      ['GET', `${config.baseUrl}/api/products/${randomItem(config.testData.productIds)}`, null, { headers }],
      ['GET', `${config.baseUrl}/api/orders/${randomItem(config.testData.orderIds)}`, null, { headers }],
    ]);

    detailBatch.forEach((res) => {
      const success = res.status === 200;
      if (success) {
        successfulRequests.add(1);
      } else {
        failedRequests.add(1);
      }
      errorRate.add(!success);
    });

    sleep(aggressiveThink());

    // 4. AI operations (resource-intensive)
    if (Math.random() < 0.3) {
      // 30% chance to use AI
      const aiRes = http.post(
        `${config.baseUrl}/api/ai/chat`,
        JSON.stringify({
          message: 'What are the top selling products this month?',
          context: {},
        }),
        {
          headers,
          tags: { name: 'AI Chat' },
          timeout: '30s', // AI can be slower
        }
      );

      const success = aiRes.status === 200;
      if (success) {
        successfulRequests.add(1);
      } else {
        failedRequests.add(1);
      }
      errorRate.add(!success);
    }
  });
}

export function teardown(data) {
  console.log('Stress test completed');
  console.log('Check for:');
  console.log('- At what load did error rate increase significantly?');
  console.log('- Did auto-scaling trigger?');
  console.log('- What was the maximum number of pods?');
  console.log('- Did the system recover gracefully during ramp-down?');
}
