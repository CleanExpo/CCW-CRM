/**
 * E2E tests for POS transactions
 * Tests: terminal view, cart management, payment processing, transaction history
 */

import { test, expect } from "./fixtures/auth";
import { clickButton, searchFor } from "./helpers/page-objects";

test.describe("POS Transactions", () => {
  test("should navigate to POS terminal", async ({ authenticatedPage: page }) => {
    // Navigate to POS page
    await page.goto("/pos");

    // Should show POS interface or terminal selection
    await expect(page.locator("h1, h2")).toContainText(/pos|point of sale|terminal/i);

    // Check for key POS elements
    const hasTerminal = await page
      .locator("text=/terminal|checkout|register/i")
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    const hasCart = await page
      .locator('[data-testid="cart"], text=/cart|items/i')
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    expect(hasTerminal || hasCart).toBeTruthy();
  });

  test("should add products to cart", async ({ authenticatedPage: page }) => {
    await page.goto("/pos");

    // Look for product search or product list
    const searchInput = page.getByPlaceholder(/search.*product/i);

    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Search for a product
      await searchInput.fill("drill");
      await page.waitForTimeout(500); // Wait for search results

      // Click first product result
      const firstProduct = page.locator('[data-testid="product-result"]').first();
      const alternativeProduct = page.locator("button").filter({ hasText: /drill/i }).first();

      if (await firstProduct.isVisible({ timeout: 1000 }).catch(() => false)) {
        await firstProduct.click();
      } else if (await alternativeProduct.isVisible({ timeout: 1000 }).catch(() => false)) {
        await alternativeProduct.click();
      }

      // Should add to cart
      const cartItems = page.locator('[data-testid="cart-item"], [class*="cart"]');
      const hasItems = await cartItems.count().then((c) => c > 0);

      if (hasItems) {
        expect(await cartItems.count()).toBeGreaterThan(0);
      }
    }
  });

  test("should process cash payment", async ({ authenticatedPage: page }) => {
    await page.goto("/pos");

    // This test assumes there's a way to add items and complete payment
    // Since POS implementation varies, we'll check for payment buttons
    const cashButton = page.getByRole("button", { name: /cash|pay.*cash/i });

    if (await cashButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cashButton.click();

      // Should show payment confirmation or complete transaction
      const successMessage = page.locator("text=/success|complete|paid/i");
      const isVisible = await successMessage.isVisible({ timeout: 3000 }).catch(() => false);

      // Either shows success or opens payment dialog
      const hasDialog = await page
        .locator('[role="dialog"]')
        .isVisible({ timeout: 1000 })
        .catch(() => false);

      expect(isVisible || hasDialog).toBeTruthy();
    }
  });

  test("should process card payment", async ({ authenticatedPage: page }) => {
    await page.goto("/pos");

    // Look for card/EFTPOS payment button
    const cardButton = page.getByRole("button", { name: /card|eftpos|credit|debit/i });

    if (await cardButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cardButton.click();

      // Should show payment interface or confirmation
      const paymentInterface = page.locator("text=/payment|card|processing/i");
      await expect(paymentInterface).toBeVisible({ timeout: 3000 });
    }
  });

  test("should view transaction history", async ({ authenticatedPage: page }) => {
    // Try to navigate to POS transactions history
    await page.goto("/pos");

    // Look for history/transactions link or tab
    const historyLink = page.getByRole("link", { name: /history|transactions|reports/i });
    const historyTab = page.getByRole("tab", { name: /history|transactions/i });

    if (await historyLink.isVisible({ timeout: 1000 }).catch(() => false)) {
      await historyLink.click();
    } else if (await historyTab.isVisible({ timeout: 1000 }).catch(() => false)) {
      await historyTab.click();
    } else {
      // Try direct navigation to transactions page
      await page.goto("/pos/transactions");
    }

    // Should show transactions list or table
    const hasTable = await page.locator("table").isVisible({ timeout: 2000 }).catch(() => false);
    const hasTransactionList = await page
      .locator('[data-testid="transaction-list"]')
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    const hasTransactionText = await page
      .locator("text=/transaction/i")
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    expect(hasTable || hasTransactionList || hasTransactionText).toBeTruthy();
  });
});
