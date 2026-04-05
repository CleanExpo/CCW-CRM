/**
 * Bank Reconciliation E2E Test
 *
 * Tests complete bank reconciliation flow:
 * - View transactions
 * - Get match suggestions
 * - Auto-match transaction
 * - Verify matched status
 */

import { test, expect } from '@playwright/test';

test.describe('Bank Reconciliation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login first (if required)
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@demo.com');
    await page.fill('input[name="password"]', 'demo123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should match bank transaction to invoice', async ({ page }) => {
    // Navigate to reconciliation page
    await page.goto('/reconciliation');

    // Wait for page to load
    await expect(page.locator('h1')).toContainText('Reconciliation');

    // Wait for transactions to load
    const transactionRow = page.locator('[data-testid="transaction-row"]').first();
    await expect(transactionRow).toBeVisible({ timeout: 10000 });

    // Click on first transaction
    await transactionRow.click();

    // Click "Suggest Matches" button
    const suggestBtn = page.locator('button:has-text("Suggest Matches")');
    if (await suggestBtn.isVisible()) {
      await suggestBtn.click();

      // Wait for suggestions to load
      await expect(page.locator('[data-testid="match-suggestion"]').first()).toBeVisible({
        timeout: 5000,
      });

      // Click "Auto-Match" on first suggestion
      const autoMatchBtn = page.locator('button:has-text("Auto-Match")').first();
      await autoMatchBtn.click();

      // Verify success notification or matched status
      await expect(
        page.locator('[data-testid="matched-badge"]').or(page.locator('text=/matched/i'))
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('should display match confidence scores', async ({ page }) => {
    await page.goto('/reconciliation');

    const transactionRow = page.locator('[data-testid="transaction-row"]').first();
    await expect(transactionRow).toBeVisible({ timeout: 10000 });
    await transactionRow.click();

    const suggestBtn = page.locator('button:has-text("Suggest Matches")');
    if (await suggestBtn.isVisible()) {
      await suggestBtn.click();

      // Verify confidence scores are displayed
      const suggestionCard = page.locator('[data-testid="match-suggestion"]').first();
      await expect(suggestionCard).toBeVisible({ timeout: 5000 });

      // Should display confidence percentage
      await expect(suggestionCard.locator('text=/%/')).toBeVisible({ timeout: 2000 });
    }
  });

  test('should handle no match suggestions gracefully', async ({ page }) => {
    await page.goto('/reconciliation');

    const transactionRow = page.locator('[data-testid="transaction-row"]').last();
    if (await transactionRow.isVisible({ timeout: 5000 })) {
      await transactionRow.click();

      const suggestBtn = page.locator('button:has-text("Suggest Matches")');
      if (await suggestBtn.isVisible()) {
        await suggestBtn.click();

        // Should show "No matches found" or similar message
        await expect(
          page.locator('text=/no matches/i').or(page.locator('[data-testid="empty-state"]'))
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
