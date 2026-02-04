/**
 * Global authentication setup for E2E tests
 * Runs before all tests to create an authenticated session
 */

import { test as setup, expect } from "@playwright/test";

const authFile = ".auth/user.json";

setup("authenticate as admin user", async ({ page }) => {
  // Navigate to login page
  await page.goto("/login");

  // Fill in login credentials (using demo credentials from CLAUDE.md)
  await page.fill('input[name="email"]', "admin@demo.com");
  await page.fill('input[name="password"]', "demo123");

  // Submit login form and wait for navigation
  // Use Promise.all to wait for both the click and the subsequent navigation
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle" }),
    page.click('button[type="submit"]'),
  ]);

  // Verify we're on the dashboard
  await expect(page).toHaveURL(/.*dashboard/);

  // Wait for dashboard to be fully loaded
  await page.waitForLoadState("networkidle");

  // Save authenticated state
  await page.context().storageState({ path: authFile });
});
