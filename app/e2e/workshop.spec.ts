/**
 * E2E tests for Workshop Management pages
 * Tests: dashboard, equipment list, schedule
 */

import { test, expect } from './fixtures/auth';

test.describe('Workshop Dashboard', () => {
  test('should display workshop dashboard', async ({ authenticatedPage: page }) => {
    await page.goto('/workshop');

    // Check page heading
    await expect(page.locator('h1')).toContainText(/workshop/i);

    // Check for location filter buttons
    await expect(page.locator('text=/all/i')).toBeVisible();
    await expect(page.locator('text=/brisbane/i')).toBeVisible();
  });

  test('should show View Schedule button', async ({ authenticatedPage: page }) => {
    await page.goto('/workshop');

    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible();
  });

  test('should filter by location', async ({ authenticatedPage: page }) => {
    await page.goto('/workshop');

    // Click Brisbane filter
    await page
      .locator('button', { hasText: /brisbane/i })
      .first()
      .click();

    // Page should still be visible (no crash)
    await expect(page.locator('h1')).toContainText(/workshop/i);
  });
});

test.describe('Workshop Equipment', () => {
  test('should display equipment list page', async ({ authenticatedPage: page }) => {
    await page.goto('/workshop/equipment');

    await expect(page.locator('h1')).toContainText(/equipment/i);

    // Should show a table or list of equipment
    await expect(page.locator("table, [role='grid'], text=/no equipment/i")).toBeVisible();
  });

  test('should show Add Equipment button', async ({ authenticatedPage: page }) => {
    await page.goto('/workshop/equipment');

    await expect(page.getByRole('button', { name: /add equipment/i })).toBeVisible();
  });
});

test.describe('Workshop Schedule', () => {
  test('should display schedule page', async ({ authenticatedPage: page }) => {
    await page.goto('/workshop/schedule');

    await expect(page.locator('h1')).toContainText(/schedule/i);
  });

  test('should show Book Service button', async ({ authenticatedPage: page }) => {
    await page.goto('/workshop/schedule');

    await expect(page.getByRole('button', { name: /book|new|service/i })).toBeVisible();
  });
});
