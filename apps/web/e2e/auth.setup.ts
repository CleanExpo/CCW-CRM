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

  // Submit login form
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL("/dashboard");

  // Verify we're logged in by checking for dashboard content
  await expect(page.locator("h1, h2")).toContainText(/dashboard/i);

  // Save authenticated state
  await page.context().storageState({ path: authFile });
});
