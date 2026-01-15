/**
 * Spike Test
 *
 * Purpose: Test system's ability to handle sudden traffic spikes
 * Duration: 5 minutes
 * Users: Sudden spike from 10 to 200 users
 * When to run: To verify HPA response time and system stability under sudden load
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { config, randomItem } from '../config.js';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Normal baseline
    { duration: '10s', target: 200 }, // Sudden spike! (HPA should trigger)
    { duration: '2m', target: 200 },  // Maintain spike (wait for scaling)
    { duration: '1m', target: 10 },   // Drop back to baseline
    { duration: '1m', target: 10 },   // Recovery
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    // Allow for degraded performance during spike
    'http_req_duration': ['p(95)<3000'], // 3 seconds acceptable during spike
    'http_req_failed': ['rate<0.15'], // Allow up to 15% failure during spike
    'errors': ['rate<0.2'], // Allow up to 20% errors during spike
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

  // Very short think time - aggressive load
  const quickThink = () => Math.random() * 0.5 + 0.2; // 0.2-0.7 seconds

  group('Spike Test - Quick Actions', () => {
    // Batch of quick read operations
    const batch = http.batch([
      ['GET', `${config.baseUrl}/health`, null, { headers, tags: { name: 'Health' } }],
      ['GET', `${config.baseUrl}/api/products`, null, { headers, tags: { name: 'Products' } }],
      ['GET', `${config.baseUrl}/api/orders`, null, { headers, tags: { name: 'Orders' } }],
      ['GET', `${config.baseUrl}/api/dashboard/stats`, null, { headers, tags: { name: 'Dashboard' } }],
    ]);

    batch.forEach((res) => {
      const success = res.status === 200;
      errorRate.add(!success);
    });

    sleep(quickThink());

    // Random detail view
    const productId = randomItem(config.testData.productIds);
    const productRes = http.get(`${config.baseUrl}/api/products/${productId}`, {
      headers,
      tags: { name: 'Product Detail' },
    });

    const success = check(productRes, {
      'product detail accessible': (r) => r.status === 200,
    });
    errorRate.add(!success);

    sleep(quickThink());

    // Occasional write operation (creates more load)
    if (Math.random() < 0.2) {
      // 20% of users create orders
      const createOrderRes = http.post(
        `${config.baseUrl}/api/orders`,
        JSON.stringify({
          customer_id: randomItem(config.testData.customerIds),
          items: [
            {
              product_id: randomItem(config.testData.productIds),
              quantity: 1,
              unit_price: 100,
            },
          ],
        }),
        {
          headers,
          tags: { name: 'Create Order' },
        }
      );

      const writeSuccess = createOrderRes.status === 201;
      errorRate.add(!writeSuccess);
    }
  });
}

export function teardown(data) {
  console.log('Spike test completed');
  console.log('');
  console.log('Expected behavior:');
  console.log('1. Initial spike may show increased latency (pods scaling up)');
  console.log('2. After 30-60s, HPA should add pods');
  console.log('3. Performance should improve as pods come online');
  console.log('4. System should remain stable throughout spike');
  console.log('5. After spike ends, pods should scale down (5-10 min delay)');
  console.log('');
  console.log('Check Grafana dashboards:');
  console.log('- Did HPA trigger?');
  console.log('- How long did scaling take?');
  console.log('- Were there any pod restarts?');
  console.log('- Did response times recover?');
}
