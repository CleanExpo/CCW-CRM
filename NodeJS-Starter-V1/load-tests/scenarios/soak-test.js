/**
 * Soak Test (Endurance Test)
 *
 * Purpose: Test system stability over extended period
 * Duration: 1 hour (configurable)
 * Users: 50 concurrent users (constant load)
 * When to run: Before major releases to identify memory leaks and degradation
 *
 * Note: This test runs for an extended period. Monitor for:
 * - Memory leaks (gradually increasing memory usage)
 * - Connection pool exhaustion
 * - File handle leaks
 * - Performance degradation over time
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { config, randomItem, think } from '../config.js';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

// Test configuration - 1 hour at constant load
export const options = {
  stages: [
    { duration: '5m', target: 50 },   // Ramp up to 50 users
    { duration: '50m', target: 50 },  // Stay at 50 users for 50 minutes
    { duration: '5m', target: 0 },    // Ramp down
  ],
  thresholds: {
    'http_req_duration': [`p(95)<${config.thresholds.http_req_duration_p95 * 1.5}`],
    'http_req_failed': [`rate<${config.thresholds.http_req_failed_rate * 2}`],
    'errors': ['rate<0.05'], // Error rate should remain low throughout
    'response_time': ['p(95)<2000'], // Response time shouldn't degrade
  },
};

let iterationCount = 0;

export function setup() {
  const loginRes = http.post(`${config.baseUrl}/api/auth/login`, JSON.stringify({
    email: config.testUser.email,
    password: config.testUser.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status === 200) {
    return {
      authToken: loginRes.json('access_token'),
      startTime: new Date().toISOString(),
    };
  }

  return { authToken: null, startTime: new Date().toISOString() };
}

export default function (data) {
  const headers = data.authToken
    ? {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.authToken}`,
      }
    : { 'Content-Type': 'application/json' };

  iterationCount++;

  // Log progress every 100 iterations
  if (iterationCount % 100 === 0) {
    console.log(`Soak test: ${iterationCount} iterations completed`);
  }

  // Realistic user journey
  group('Soak Test - Realistic Workflow', () => {
    // 1. Dashboard view (common starting point)
    const dashboardStart = Date.now();
    const dashboardRes = http.get(`${config.baseUrl}/api/dashboard/stats`, {
      headers,
      tags: { name: 'Dashboard' },
    });

    const dashboardSuccess = check(dashboardRes, {
      'dashboard accessible': (r) => r.status === 200,
    });

    responseTime.add(Date.now() - dashboardStart);
    errorRate.add(!dashboardSuccess);
    sleep(think());

    // 2. Browse products
    const productsStart = Date.now();
    const productsRes = http.get(`${config.baseUrl}/api/products?page=1&limit=20`, {
      headers,
      tags: { name: 'Products' },
    });

    check(productsRes, {
      'products list accessible': (r) => r.status === 200,
    });

    responseTime.add(Date.now() - productsStart);
    sleep(think());

    // 3. View product details (with inventory check)
    const productId = randomItem(config.testData.productIds);
    const productDetailStart = Date.now();

    const batch = http.batch([
      ['GET', `${config.baseUrl}/api/products/${productId}`, null, { headers }],
      ['GET', `${config.baseUrl}/api/inventory?product_id=${productId}`, null, { headers }],
    ]);

    batch.forEach((res) => {
      errorRate.add(res.status !== 200);
    });

    responseTime.add(Date.now() - productDetailStart);
    sleep(think());

    // 4. Check orders (70% of users)
    if (Math.random() < 0.7) {
      const ordersStart = Date.now();
      const ordersRes = http.get(`${config.baseUrl}/api/orders?page=1&limit=10`, {
        headers,
        tags: { name: 'Orders' },
      });

      check(ordersRes, {
        'orders accessible': (r) => r.status === 200,
      });

      responseTime.add(Date.now() - ordersStart);
      sleep(think());

      // View order details
      const orderId = randomItem(config.testData.orderIds);
      const orderDetailRes = http.get(`${config.baseUrl}/api/orders/${orderId}`, {
        headers,
        tags: { name: 'Order Detail' },
      });

      check(orderDetailRes, {
        'order detail accessible': (r) => r.status === 200,
      });

      sleep(think());
    }

    // 5. Create quote (30% of users)
    if (Math.random() < 0.3) {
      const quoteStart = Date.now();
      const createQuoteRes = http.post(
        `${config.baseUrl}/api/quotes`,
        JSON.stringify({
          customer_id: randomItem(config.testData.customerIds),
          items: [
            {
              product_id: randomItem(config.testData.productIds),
              quantity: Math.floor(Math.random() * 5) + 1,
              unit_price: Math.floor(Math.random() * 500) + 50,
            },
          ],
          notes: `Soak test quote ${Date.now()}`,
        }),
        {
          headers,
          tags: { name: 'Create Quote' },
        }
      );

      const quoteSuccess = check(createQuoteRes, {
        'quote created': (r) => r.status === 201,
      });

      responseTime.add(Date.now() - quoteStart);
      errorRate.add(!quoteSuccess);
      sleep(think());
    }

    // 6. Create order (20% of users)
    if (Math.random() < 0.2) {
      const orderStart = Date.now();
      const createOrderRes = http.post(
        `${config.baseUrl}/api/orders`,
        JSON.stringify({
          customer_id: randomItem(config.testData.customerIds),
          items: [
            {
              product_id: randomItem(config.testData.productIds),
              quantity: Math.floor(Math.random() * 3) + 1,
              unit_price: Math.floor(Math.random() * 300) + 50,
            },
          ],
          shipping_address: {
            street: `${Math.floor(Math.random() * 9999)} Test St`,
            city: 'Test City',
            state: 'TS',
            zip: '12345',
            country: 'US',
          },
        }),
        {
          headers,
          tags: { name: 'Create Order' },
        }
      );

      const orderSuccess = check(createOrderRes, {
        'order created': (r) => r.status === 201,
      });

      responseTime.add(Date.now() - orderStart);
      errorRate.add(!orderSuccess);
      sleep(think());
    }

    // 7. AI insights (10% of users)
    if (Math.random() < 0.1) {
      const aiStart = Date.now();
      const insightsRes = http.get(`${config.baseUrl}/api/ai/insights`, {
        headers,
        tags: { name: 'AI Insights' },
        timeout: '30s',
      });

      check(insightsRes, {
        'insights accessible': (r) => r.status === 200,
      });

      responseTime.add(Date.now() - aiStart);
      sleep(think());
    }

    // 8. Health check (every user, but lightweight)
    const healthRes = http.get(`${config.baseUrl}/health`, {
      headers,
      tags: { name: 'Health' },
    });

    check(healthRes, {
      'system healthy': (r) => r.status === 200,
    });
  });
}

export function teardown(data) {
  const endTime = new Date().toISOString();
  console.log('');
  console.log('Soak test completed');
  console.log(`Start time: ${data.startTime}`);
  console.log(`End time:   ${endTime}`);
  console.log('');
  console.log('Review the following in Grafana:');
  console.log('1. Memory usage trend - should remain stable');
  console.log('2. CPU usage trend - should remain stable');
  console.log('3. Response time trend - should not degrade');
  console.log('4. Error rate trend - should remain low');
  console.log('5. Database connection pool - no leaks');
  console.log('6. Redis memory usage - should be stable');
  console.log('7. Celery queue length - should not grow unbounded');
  console.log('');
  console.log('Signs of problems:');
  console.log('- Gradually increasing response times');
  console.log('- Memory usage creeping up over time');
  console.log('- Connection pool exhaustion');
  console.log('- Increasing error rates over time');
}
