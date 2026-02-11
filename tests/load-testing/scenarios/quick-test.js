/**
 * Quick Load Test - 20 Key Scenarios
 *
 * Fast baseline test covering critical endpoints
 *
 * Usage:
 *   k6 run --vus 5 --duration 2m quick-test.js
 */

import { sleep } from 'k6';
import { testConfig } from '../config/test-config.js';
import {
  authenticate,
  authenticatedGet,
  checkHealth,
  thinkTime,
} from './utils.js';

export const options = {
  vus: 5,
  duration: '2m',
  thresholds: testConfig.thresholds,
};

const baseUrl = testConfig.baseUrl;
let authToken = null;

export function setup() {
  console.log('[*] Starting quick load test...');
  checkHealth(baseUrl);
  return { startTime: new Date().toISOString() };
}

export default function () {
  if (!authToken) {
    authToken = authenticate(
      baseUrl,
      testConfig.auth.email,
      testConfig.auth.password
    );

    if (!authToken) {
      console.error('[ERROR] Authentication failed');
      return;
    }
  }

  // Test health
  checkHealth(baseUrl);

  // Test core endpoints
  authenticatedGet(`${baseUrl}/api/products`, authToken, { endpoint: 'products' });
  thinkTime(1, 2);

  authenticatedGet(`${baseUrl}/api/customers`, authToken, { endpoint: 'customers' });
  thinkTime(1, 2);

  authenticatedGet(`${baseUrl}/api/orders`, authToken, { endpoint: 'orders' });
  thinkTime(1, 2);

  authenticatedGet(`${baseUrl}/api/quotes`, authToken, { endpoint: 'quotes' });
  thinkTime(1, 2);
}

export function teardown(data) {
  console.log('[OK] Quick load test completed');
  console.log(`    Duration: ${(Date.now() - new Date(data.startTime).getTime()) / 1000}s`);
}
