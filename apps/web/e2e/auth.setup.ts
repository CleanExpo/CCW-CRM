/**
 * Global authentication setup for E2E tests
 * Runs before all tests to create an authenticated session
 */

import { test as setup, expect } from '@playwright/test';

const authFile = '.auth/user.json';

setup('authenticate as admin user', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login');

  // Fill in login credentials (using demo credentials from CLAUDE.md)
  await page.fill('input[name="email"]', 'admin@ccwonline.com.au');
  await page.fill('input[name="password"]', 'demo123');

  // Submit the form — may redirect to /onboarding (first-time users) or /dashboard
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|onboarding)/, { waitUntil: 'networkidle', timeout: 15_000 });

  // If redirected to onboarding, navigate straight to dashboard
  if (page.url().includes('/onboarding')) {
    await page.goto('/dashboard');
    await page.waitForURL(/.*dashboard/, { waitUntil: 'networkidle', timeout: 15_000 });
  }

  // Verify we're on the dashboard
  await expect(page).toHaveURL(/.*dashboard/);

  // Save authenticated state for all subsequent E2E tests
  await page.context().storageState({ path: authFile });
});
