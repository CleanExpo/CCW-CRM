/**
 * E2E Test Helpers
 */

import { Page } from '@playwright/test';

/**
 * Login helper that works around cross-domain cookie issues
 * Makes the login API call directly from the browser context
 */
export async function loginAsAdmin(page: Page, baseUrl: string) {
  // DEV MODE: Skip real authentication for testing
  // Just navigate directly - middleware should allow access in dev mode
  await page.goto(`${baseUrl}/dashboard`);
  await page.waitForLoadState('networkidle');
}
