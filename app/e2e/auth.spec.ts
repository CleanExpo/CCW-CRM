/**
 * E2E tests for authentication flows
 * Tests: login, logout, protected routes, session persistence
 */

import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("should successfully login with valid credentials", async ({ page }) => {
    await page.goto("/login");

    // Fill in login form
    await page.fill('input[name="email"]', "admin@demo.com");
    await page.fill('input[name="password"]', "demo123");

    // Submit form
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await page.waitForURL("/dashboard");
    await expect(page.locator("h1, h2")).toContainText(/dashboard/i);
  });

  test("should show error with invalid credentials", async ({ page }) => {
    await page.goto("/login");

    // Fill in login form with invalid credentials
    await page.fill('input[name="email"]', "invalid@example.com");
    await page.fill('input[name="password"]', "wrongpassword");

    // Submit form
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('[role="alert"], [role="status"]')).toContainText(
      /invalid|incorrect|failed/i
    );

    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test("should logout and clear session", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@demo.com");
    await page.fill('input[name="password"]', "demo123");
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard");

    // Find and click logout button (could be in dropdown or header)
    const logoutButton = page.getByRole("button", { name: /logout|sign out/i });
    await logoutButton.click();

    // Should redirect to login page
    await page.waitForURL("/login");
    await expect(page).toHaveURL(/\/login/);

    // Verify can't access dashboard without login
    await page.goto("/dashboard");
    await page.waitForURL("/login");
  });

  test("should redirect to login when accessing protected route while unauthenticated", async ({
    page,
  }) => {
    // Try to access protected route
    await page.goto("/dashboard");

    // Should redirect to login
    await page.waitForURL("/login");
    await expect(page).toHaveURL(/\/login/);
  });

  test("should persist login across page refreshes", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@demo.com");
    await page.fill('input[name="password"]', "demo123");
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard");

    // Refresh page
    await page.reload();

    // Should still be on dashboard (not redirected to login)
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator("h1, h2")).toContainText(/dashboard/i);
  });
});
