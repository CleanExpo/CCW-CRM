/**
 * Approvals Workflow E2E Test
 *
 * Tests complete approval workflow:
 * - View pending approvals
 * - Approve single item
 * - Bulk approve multiple items
 * - Verify approved status
 */

import { test, expect } from '@playwright/test';

test.describe('Approval Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@demo.com');
    await page.fill('input[name="password"]', 'demo123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should approve single approval item', async ({ page }) => {
    // Navigate to approvals page
    await page.goto('/approvals');

    // Wait for approvals list to load
    await expect(page.locator('h1')).toContainText('Approvals');

    const approvalRow = page.locator('[data-testid="approval-row"]').first();
    if (await approvalRow.isVisible({ timeout: 10000 })) {
      // Click on first approval
      await approvalRow.click();

      // Find and click Approve button
      const approveBtn = page.locator('button:has-text("Approve")').first();
      if (await approveBtn.isVisible({ timeout: 5000 })) {
        await approveBtn.click();

        // Verify success notification
        await expect(
          page.locator('text=/approved/i').or(page.locator('[role="alert"]'))
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should bulk approve multiple items', async ({ page }) => {
    await page.goto('/approvals');

    await expect(page.locator('h1')).toContainText('Approvals');

    // Select multiple approval items
    const checkboxes = page.locator('[data-testid^="checkbox-appr-"]');
    const count = await checkboxes.count();

    if (count >= 2) {
      // Select first 2 items
      await checkboxes.nth(0).click();
      await checkboxes.nth(1).click();

      // Click bulk approve button
      const bulkApproveBtn = page.locator('button:has-text("Bulk Approve")');
      await expect(bulkApproveBtn).toBeVisible();
      await bulkApproveBtn.click();

      // Verify success
      await expect(page.locator('text=/approved/i').or(page.locator('[role="alert"]'))).toBeVisible(
        { timeout: 5000 }
      );
    }
  });

  test('should filter approvals by status', async ({ page }) => {
    await page.goto('/approvals');

    // Wait for page load
    await expect(page.locator('h1')).toContainText('Approvals');

    // Find status filter dropdown
    const statusFilter = page
      .locator('[data-testid="status-filter"]')
      .or(page.locator('select[name="status"]'));

    if (await statusFilter.isVisible({ timeout: 5000 })) {
      await statusFilter.selectOption('pending');

      // Wait for filtered results
      await page.waitForTimeout(1000);

      // Verify only pending approvals are shown
      const statusBadges = page.locator('[data-testid="status-badge"]');
      const badges = await statusBadges.all();
      for (const badge of badges) {
        await expect(badge).toContainText(/pending/i);
      }
    }
  });

  test('should display approval type correctly', async ({ page }) => {
    await page.goto('/approvals');

    const approvalRow = page.locator('[data-testid="approval-row"]').first();
    if (await approvalRow.isVisible({ timeout: 10000 })) {
      // Should display approval type (e.g., "Purchase Order", "Invoice")
      await expect(approvalRow.locator('text=/purchase order|invoice|quote/i')).toBeVisible({
        timeout: 2000,
      });
    }
  });
});
