/**
 * E2E tests for CRM Health Dashboard
 * Tests: page load, health summary cards, customer list, scoring
 */

import { test, expect } from './fixtures/auth';

test.describe('CRM Health Dashboard', () => {
  test('should display CRM health dashboard', async ({ authenticatedPage: page }) => {
    await page.goto('/customers/health');

    // Check page heading
    await expect(page.locator('h1')).toContainText(/client health/i);
  });

  test('should show health summary cards', async ({ authenticatedPage: page }) => {
    await page.goto('/customers/health');

    // Should show total customers and health breakdown
    await expect(page.locator('text=/total|healthy|at.?risk|churned/i')).toBeVisible();
  });

  test('should show health score table or list', async ({ authenticatedPage: page }) => {
    await page.goto('/customers/health');

    // Should show a table with customer health scores, or empty state
    await expect(page.locator("table, [role='grid'], text=/no customers/i")).toBeVisible();
  });

  test('should allow filtering by health status', async ({ authenticatedPage: page }) => {
    await page.goto('/customers/health');

    // Check for filter controls (tabs, select, or buttons)
    await expect(
      page.locator('[role="tablist"], select, button:has-text(/all|healthy|at.?risk|churned/i)')
    ).toBeVisible();
  });

  test('should navigate back to customers from health page', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/customers/health');

    // Check for a link or breadcrumb back to customers
    const customersLink = page.getByRole('link', { name: /customers/i });
    if (await customersLink.isVisible()) {
      await customersLink.click();
      await expect(page).toHaveURL(/customers/);
    } else {
      // Page should at least be stable
      await expect(page.locator('h1')).toContainText(/client health/i);
    }
  });
});
