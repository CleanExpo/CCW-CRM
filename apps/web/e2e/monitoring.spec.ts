/**
 * E2E tests for monitoring dashboard
 * Tests: view dashboard, switch tabs, metrics display
 */

import { test, expect } from "./fixtures/auth";

test.describe("Monitoring Dashboard", () => {
  test("should display monitoring dashboard", async ({ authenticatedPage: page }) => {
    await page.goto("/monitoring");

    // Check page title
    await expect(page.locator("h1, h2")).toContainText(/monitoring|system health/i);

    // Check for tabs
    await expect(page.locator('[role="tablist"]')).toBeVisible();

    // Check for key tabs
    await expect(page.getByRole("tab", { name: /infrastructure/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /business/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /performance/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /alerts/i })).toBeVisible();
  });

  test("should switch between tabs and display content", async ({ authenticatedPage: page }) => {
    await page.goto("/monitoring");

    // Click Infrastructure tab
    await page.getByRole("tab", { name: /infrastructure/i }).click();

    // Should show infrastructure content
    await expect(page.locator("text=/database|postgres|redis/i")).toBeVisible();

    // Click Business Metrics tab
    await page.getByRole("tab", { name: /business/i }).click();

    // Should show business metrics
    await expect(
      page.locator("text=/orders|revenue|customers|transactions/i")
    ).toBeVisible();

    // Click Performance tab
    await page.getByRole("tab", { name: /performance/i }).click();

    // Should show performance metrics
    await expect(
      page.locator("text=/response time|requests|latency|throughput/i")
    ).toBeVisible();

    // Click Alerts tab
    await page.getByRole("tab", { name: /alerts/i }).click();

    // Should show alerts
    await expect(page.locator("text=/alert|warning|critical|status/i")).toBeVisible();
  });
});
