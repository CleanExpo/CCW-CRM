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
import { authenticate, authenticatedGet, checkHealth, thinkTime } from './utils.js';

export const options = {
  vus: 5,
  duration: '2m',
  thresholds: testConfig.thresholds,
};

const baseUrl = testConfig.baseUrl;

export function setup() {
  console.log('[*] Starting quick load test...');
  checkHealth(baseUrl);

  // Authenticate once in setup phase and return token to all VUs
  const token = authenticate(baseUrl, testConfig.auth.email, testConfig.auth.password);

  if (!token) {
    console.error('[ERROR] Authentication failed in setup phase');
    throw new Error('Authentication failed - cannot proceed with test');
  }

  console.log('[OK] Authentication successful');
  return {
    startTime: new Date().toISOString(),
    authToken: token,
  };
}

export default function (data) {
  // Use token from setup phase - persists across all iterations
  const authToken = data.authToken;

  // Debug: Log token to verify it's being passed
  if (!authToken) {
    console.error('[ERROR] No auth token received from setup phase');
    return;
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
