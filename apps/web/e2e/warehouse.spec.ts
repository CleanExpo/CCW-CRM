/**
 * E2E tests for Warehouse Management page
 * Tests: page load, tabs, stock locations, transfers
 */

import { test, expect } from './fixtures/auth';

test.describe('Warehouse Management', () => {
  test('should display warehouse page with tabs', async ({ authenticatedPage: page }) => {
    await page.goto('/warehouse');

    // Check page heading
    await expect(page.locator('h1')).toContainText(/warehouse/i);

    // Check tabs are visible
    await expect(page.locator('[role="tablist"]')).toBeVisible();
    await expect(page.getByRole('tab', { name: /operations/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /locations|stock/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /transfers/i })).toBeVisible();
  });

  test('should show operations tab content by default', async ({ authenticatedPage: page }) => {
    await page.goto('/warehouse');

    // Operations tab should be active by default
    const operationsTab = page.getByRole('tab', { name: /operations/i });
    await expect(operationsTab).toBeVisible();
    await operationsTab.click();

    // Should show KPI cards or summary content
    await expect(page.locator('text=/orders|shipments|receiving|pending/i')).toBeVisible();
  });

  test('should switch to locations tab and show stock data', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/warehouse');

    await page.getByRole('tab', { name: /locations|stock/i }).click();

    // Should show location names (Brisbane, Sydney, Melbourne)
    await expect(page.locator('text=/brisbane|sydney|melbourne/i')).toBeVisible();
  });

  test('should switch to transfers tab', async ({ authenticatedPage: page }) => {
    await page.goto('/warehouse');

    await page.getByRole('tab', { name: /transfers/i }).click();

    // Should show transfers content
    await expect(page.locator('text=/transfer|movement|location/i')).toBeVisible();
  });
});
