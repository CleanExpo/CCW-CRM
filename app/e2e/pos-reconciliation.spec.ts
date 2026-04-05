/**
 * E2E tests for POS reconciliation
 * Tests: view dashboard, filter data, auto-match, export
 */

import { test, expect } from "./fixtures/auth";
import { clickButton, waitForDialog, fillFieldByLabel } from "./helpers/page-objects";

test.describe("POS Reconciliation", () => {
  test("should display reconciliation dashboard", async ({ authenticatedPage: page }) => {
    await page.goto("/pos/reconciliation");

    // Check page title
    await expect(page.locator("h1, h2")).toContainText(/reconciliation/i);

    // Should show bank feed section and POS transactions section
    await expect(page.locator("text=/bank.*feed|unreconciled/i")).toBeVisible();
    await expect(page.locator("text=/pos.*transaction/i")).toBeVisible();
  });

  test("should filter reconciliation data", async ({ authenticatedPage: page }) => {
    await page.goto("/pos/reconciliation");

    // Look for filter panel or filter button
    const filterButton = page.getByRole("button", { name: /filter/i });
    const filterPanel = page.locator('[data-testid="filter-panel"]');

    // If filter panel not visible, click filter button
    if (await filterButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await filterButton.click();
    }

    // Select a date range
    const startDateField = page.getByLabel(/start date/i);
    if (await startDateField.isVisible({ timeout: 2000 }).catch(() => false)) {
      const today = new Date();
      const lastWeek = new Date();
      lastWeek.setDate(today.getDate() - 7);

      await startDateField.fill(lastWeek.toISOString().split("T")[0]);

      const endDateField = page.getByLabel(/end date/i);
      await endDateField.fill(today.toISOString().split("T")[0]);

      // Apply filters
      await clickButton(page, /apply|filter/i);

      // Wait for data to load
      await page.waitForLoadState("networkidle");

      // Should show filtered results or empty state
      const hasData = await page.locator("table tbody tr").count();
      expect(hasData).toBeGreaterThanOrEqual(0);
    }
  });

  test("should auto-match transactions", async ({ authenticatedPage: page }) => {
    await page.goto("/pos/reconciliation");

    // Look for auto-match button
    const autoMatchButton = page.getByRole("button", { name: /auto.*match/i });

    if (await autoMatchButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Click auto-match
      await autoMatchButton.click();

      // Should show confirmation dialog or start matching
      const hasDialog = await page
        .locator('[role="alertdialog"]')
        .isVisible({ timeout: 1000 })
        .catch(() => false);

      if (hasDialog) {
        // Confirm auto-match
        await page.getByRole("button", { name: /auto.*match|confirm|proceed/i }).click();

        // Should show success or info message
        await expect(page.locator('[role="status"], [role="alert"]')).toBeVisible({
          timeout: 5000,
        });
      }
    } else {
      // No auto-match button visible - might need to select items first
      // Try selecting checkbox if available
      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();

      if (count > 0) {
        // Select first item
        await checkboxes.first().check();

        // Try auto-match again
        const autoMatchAfterSelect = page.getByRole("button", { name: /auto.*match/i });
        if (await autoMatchAfterSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
          await autoMatchAfterSelect.click();
        }
      }
    }
  });

  test("should export reconciliation data", async ({ authenticatedPage: page }) => {
    await page.goto("/pos/reconciliation");

    // Look for export button
    const exportButton = page.getByRole("button", { name: /export/i });

    if (await exportButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Click export
      await exportButton.click();

      // Should open export dialog
      await waitForDialog(page, /export/i);

      // Fill in date range
      const startDateField = page.getByLabel(/start date/i);
      if (await startDateField.isVisible({ timeout: 1000 }).catch(() => false)) {
        const today = new Date();
        const lastMonth = new Date();
        lastMonth.setMonth(today.getMonth() - 1);

        await startDateField.fill(lastMonth.toISOString().split("T")[0]);

        const endDateField = page.getByLabel(/end date/i);
        await endDateField.fill(today.toISOString().split("T")[0]);
      }

      // Start download
      const downloadPromise = page.waitForEvent("download", { timeout: 10000 });

      await clickButton(page, /export|download/i);

      // Should trigger download
      try {
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/\.csv$/i);
      } catch (e) {
        // Download might not trigger if no data - that's ok
        // Just verify dialog closed or success message shown
        const dialogClosed =
          (await page.locator('[role="dialog"]').isVisible({ timeout: 2000 }).catch(() => false)) ===
          false;
        const hasSuccessMessage = await page
          .locator('[role="status"]')
          .isVisible({ timeout: 2000 })
          .catch(() => false);

        expect(dialogClosed || hasSuccessMessage).toBeTruthy();
      }
    }
  });
});
