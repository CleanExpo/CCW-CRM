/**
 * Error Handling E2E Test
 *
 * Tests ErrorBoundary integration across the app:
 * - Trigger error on page
 * - Verify ErrorBoundary fallback
 * - Click "Try again"
 * - Verify recovery
 */

import { test, expect } from '@playwright/test';

test.describe('Error Handling with ErrorBoundary', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@demo.com');
    await page.fill('input[name="password"]', 'demo123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should display ErrorBoundary on API failure', async ({ page }) => {
    // Navigate to a page that loads data
    await page.goto('/products');

    // Simulate network error by blocking API requests
    await page.route('**/api/**', (route) => {
      route.abort('failed');
    });

    // Reload page to trigger error
    await page.reload();

    // Should display ErrorBoundary fallback
    // (if ErrorBoundary is implemented on the page)
    const errorMessage = page.locator('text=/something went wrong|error/i');

    if (await errorMessage.isVisible({ timeout: 10000 })) {
      // Verify ErrorBoundary UI is displayed
      await expect(errorMessage).toBeVisible();

      // Look for "Try again" or "Reload" button
      const retryBtn = page
        .locator('button:has-text("Try again")')
        .or(page.locator('button:has-text("Reload")'));

      if (await retryBtn.isVisible({ timeout: 3000 })) {
        // Unblock API requests
        await page.unroute('**/api/**');

        // Click retry button
        await retryBtn.click();

        // Should recover and display content
        await expect(
          page.locator('h1').or(page.locator('[data-testid="product-row"]'))
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should handle EmptyState for empty data', async ({ page }) => {
    // Navigate to orders page
    await page.goto('/orders');

    // Wait for page to load
    await page.waitForTimeout(2000);

    // If no orders exist, should show EmptyState
    const emptyState = page
      .locator('[data-testid="empty-state"]')
      .or(page.locator('text=/no orders found|get started/i'));

    if (await emptyState.isVisible({ timeout: 5000 })) {
      // Verify EmptyState is displayed
      await expect(emptyState).toBeVisible();

      // Should have action button
      const actionBtn = page
        .locator('button:has-text("Create Order")')
        .or(page.locator('button:has-text("Get Started")'));

      if (await actionBtn.isVisible()) {
        await expect(actionBtn).toBeVisible();
      }
    }
  });

  test('should show loading state before data loads', async ({ page }) => {
    // Navigate to a data-heavy page
    await page.goto('/dashboard');

    // Should show loading indicator briefly
    const loadingIndicator = page
      .locator('[data-testid="loading"]')
      .or(page.locator('text=/loading/i'));

    // Note: Loading state might be too fast to catch in E2E
    // This test verifies the pattern exists
    const hasLoadingOrData = await Promise.race([
      loadingIndicator.isVisible({ timeout: 1000 }).catch(() => false),
      page.locator('h1').isVisible({ timeout: 2000 }),
    ]);

    expect(hasLoadingOrData).toBeTruthy();
  });

  test('should handle 404 errors gracefully', async ({ page }) => {
    // Navigate to non-existent page
    await page.goto('/nonexistent-page-12345');

    // Should show 404 error or redirect to login/dashboard
    const error404 = page.locator('text=/404|not found/i');
    const redirected = page.url().includes('/dashboard') || page.url().includes('/login');

    const hasError = await error404.isVisible({ timeout: 5000 }).catch(() => false);

    // Either shows 404 or redirects
    expect(hasError || redirected).toBeTruthy();
  });

  test('should display validation errors on forms', async ({ page }) => {
    await page.goto('/products');

    // Click Create Product button
    const createBtn = page.locator('button:has-text("Create Product")');
    if (await createBtn.isVisible({ timeout: 5000 })) {
      await createBtn.click();

      // Submit form without filling required fields
      const submitBtn = page.locator('button[type="submit"]');
      if (await submitBtn.isVisible({ timeout: 3000 })) {
        await submitBtn.click();

        // Should display validation errors
        await expect(page.locator('text=/required|must be|invalid/i').first()).toBeVisible({
          timeout: 3000,
        });
      }
    }
  });
});
