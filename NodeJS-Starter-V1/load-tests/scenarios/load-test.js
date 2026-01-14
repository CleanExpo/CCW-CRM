/**
 * Load Test
 *
 * Purpose: Test system under normal expected load
 * Duration: 10 minutes
 * Users: Ramp from 0 to 100 concurrent users
 * When to run: Before production deployment to verify capacity
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { config, randomItem, think } from '../config.js';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const orderCreationTime = new Trend('order_creation_time');
const quoteCreationTime = new Trend('quote_creation_time');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 20 },  // Ramp-up to 20 users
    { duration: '3m', target: 50 },  // Ramp-up to 50 users
    { duration: '3m', target: 100 }, // Ramp-up to 100 users
    { duration: '1m', target: 100 }, // Stay at 100 users
    { duration: '1m', target: 0 },   // Ramp-down to 0 users
  ],
  thresholds: {
    'http_req_duration': [`p(95)<${config.thresholds.http_req_duration_p95}`],
    'http_req_duration': [`p(99)<${config.thresholds.http_req_duration_p99}`],
    'http_req_failed': [`rate<${config.thresholds.http_req_failed_rate}`],
    'errors': ['rate<0.1'], // Error rate should be less than 10%
    'order_creation_time': [`p(95)<${config.thresholds.create_duration}`],
    'quote_creation_time': [`p(95)<${config.thresholds.create_duration}`],
  },
};

export function setup() {
  // Login to get auth token
  const loginRes = http.post(`${config.baseUrl}/api/auth/login`, JSON.stringify({
    email: config.testUser.email,
    password: config.testUser.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status === 200) {
    return { authToken: loginRes.json('access_token') };
  }

  console.error('Login failed in setup');
  return { authToken: null };
}

export default function (data) {
  const headers = data.authToken
    ? {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.authToken}`,
      }
    : { 'Content-Type': 'application/json' };

  // Simulate different user behaviors
  const userBehavior = Math.random();

  if (userBehavior < 0.4) {
    // 40% - Browse products and view orders
    browseProductsScenario(headers);
  } else if (userBehavior < 0.7) {
    // 30% - Create and manage quotes
    quoteManagementScenario(headers);
  } else if (userBehavior < 0.9) {
    // 20% - Order management workflow
    orderManagementScenario(headers);
  } else {
    // 10% - Dashboard and reporting
    dashboardScenario(headers);
  }
}

function browseProductsScenario(headers) {
  group('Browse Products', () => {
    // 1. View products list
    const productsRes = http.get(`${config.baseUrl}/api/products?page=1&limit=20`, {
      headers,
      tags: { name: 'Products List' },
    });

    const success = check(productsRes, {
      'products list success': (r) => r.status === 200,
    });
    errorRate.add(!success);
    sleep(think());

    // 2. Search products
    const searchRes = http.get(`${config.baseUrl}/api/products?search=equipment`, {
      headers,
      tags: { name: 'Products Search' },
    });

    check(searchRes, {
      'search success': (r) => r.status === 200,
    });
    sleep(think());

    // 3. View product details
    const productId = randomItem(config.testData.productIds);
    const productRes = http.get(`${config.baseUrl}/api/products/${productId}`, {
      headers,
      tags: { name: 'Product Detail' },
    });

    check(productRes, {
      'product detail success': (r) => r.status === 200,
    });
    sleep(think());

    // 4. Check inventory
    const inventoryRes = http.get(`${config.baseUrl}/api/inventory?product_id=${productId}`, {
      headers,
      tags: { name: 'Inventory Check' },
    });

    check(inventoryRes, {
      'inventory check success': (r) => r.status === 200,
    });
    sleep(think());

    // 5. View orders
    const ordersRes = http.get(`${config.baseUrl}/api/orders?page=1&limit=10`, {
      headers,
      tags: { name: 'Orders List' },
    });

    check(ordersRes, {
      'orders list success': (r) => r.status === 200,
    });
  });
}

function quoteManagementScenario(headers) {
  group('Quote Management', () => {
    // 1. View quotes list
    const quotesRes = http.get(`${config.baseUrl}/api/quotes`, {
      headers,
      tags: { name: 'Quotes List' },
    });

    check(quotesRes, {
      'quotes list success': (r) => r.status === 200,
    });
    sleep(think());

    // 2. Create new quote
    const customerId = randomItem(config.testData.customerIds);
    const productId = randomItem(config.testData.productIds);

    const createQuoteRes = http.post(
      `${config.baseUrl}/api/quotes`,
      JSON.stringify({
        customer_id: customerId,
        items: [
          {
            product_id: productId,
            quantity: Math.floor(Math.random() * 10) + 1,
            unit_price: Math.floor(Math.random() * 1000) + 100,
          },
        ],
        notes: `Load test quote ${Date.now()}`,
      }),
      {
        headers,
        tags: { name: 'Create Quote' },
      }
    );

    const quoteSuccess = check(createQuoteRes, {
      'create quote success': (r) => r.status === 201,
      'quote has id': (r) => r.json('id') !== undefined,
    });

    quoteCreationTime.add(createQuoteRes.timings.duration);
    errorRate.add(!quoteSuccess);

    if (quoteSuccess && createQuoteRes.json('id')) {
      const quoteId = createQuoteRes.json('id');
      sleep(think());

      // 3. Get quote details
      const quoteDetailRes = http.get(`${config.baseUrl}/api/quotes/${quoteId}`, {
        headers,
        tags: { name: 'Quote Detail' },
      });

      check(quoteDetailRes, {
        'quote detail success': (r) => r.status === 200,
      });
      sleep(think());

      // 4. Update quote status
      const updateQuoteRes = http.patch(
        `${config.baseUrl}/api/quotes/${quoteId}`,
        JSON.stringify({
          status: 'sent',
        }),
        {
          headers,
          tags: { name: 'Update Quote' },
        }
      );

      check(updateQuoteRes, {
        'update quote success': (r) => r.status === 200,
      });
    }
  });
}

function orderManagementScenario(headers) {
  group('Order Management', () => {
    // 1. View orders list
    const ordersRes = http.get(`${config.baseUrl}/api/orders`, {
      headers,
      tags: { name: 'Orders List' },
    });

    check(ordersRes, {
      'orders list success': (r) => r.status === 200,
    });
    sleep(think());

    // 2. Create new order
    const customerId = randomItem(config.testData.customerIds);
    const productId = randomItem(config.testData.productIds);

    const createOrderRes = http.post(
      `${config.baseUrl}/api/orders`,
      JSON.stringify({
        customer_id: customerId,
        items: [
          {
            product_id: productId,
            quantity: Math.floor(Math.random() * 5) + 1,
            unit_price: Math.floor(Math.random() * 1000) + 100,
          },
        ],
        shipping_address: {
          street: '123 Test Street',
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
      'create order success': (r) => r.status === 201,
      'order has id': (r) => r.json('id') !== undefined,
    });

    orderCreationTime.add(createOrderRes.timings.duration);
    errorRate.add(!orderSuccess);

    if (orderSuccess && createOrderRes.json('id')) {
      const orderId = createOrderRes.json('id');
      sleep(think());

      // 3. Get order details
      const orderDetailRes = http.get(`${config.baseUrl}/api/orders/${orderId}`, {
        headers,
        tags: { name: 'Order Detail' },
      });

      check(orderDetailRes, {
        'order detail success': (r) => r.status === 200,
      });
      sleep(think());

      // 4. Update order status
      const updateOrderRes = http.patch(
        `${config.baseUrl}/api/orders/${orderId}`,
        JSON.stringify({
          status: 'processing',
        }),
        {
          headers,
          tags: { name: 'Update Order' },
        }
      );

      check(updateOrderRes, {
        'update order success': (r) => r.status === 200,
      });
    }
  });
}

function dashboardScenario(headers) {
  group('Dashboard & Reporting', () => {
    // 1. Get dashboard stats
    const dashboardRes = http.get(`${config.baseUrl}/api/dashboard/stats`, {
      headers,
      tags: { name: 'Dashboard Stats' },
    });

    check(dashboardRes, {
      'dashboard success': (r) => r.status === 200,
    });
    sleep(think());

    // 2. Get AI insights
    const insightsRes = http.get(`${config.baseUrl}/api/ai/insights`, {
      headers,
      tags: { name: 'AI Insights' },
    });

    check(insightsRes, {
      'insights success': (r) => r.status === 200,
    });
    sleep(think());

    // 3. Check inventory levels
    const inventoryRes = http.get(`${config.baseUrl}/api/inventory`, {
      headers,
      tags: { name: 'Inventory List' },
    });

    check(inventoryRes, {
      'inventory list success': (r) => r.status === 200,
    });
    sleep(think());

    // 4. Check backorders
    const backordersRes = http.get(`${config.baseUrl}/api/backorders`, {
      headers,
      tags: { name: 'Backorders List' },
    });

    check(backordersRes, {
      'backorders list success': (r) => r.status === 200,
    });
  });
}

export function teardown(data) {
  console.log('Load test completed');
}
