/**
 * E2E tests for product management
 * Tests: list, search, create, edit, deactivate
 */

import { test, expect } from "./fixtures/auth";
import {
  expectSuccessToast,
  fillFieldByLabel,
  clickButton,
  searchFor,
  waitForDialog,
  findTableRowByText,
  clickRowButton,
  confirmDeletion,
} from "./helpers/page-objects";
import { createTestProduct } from "./helpers/test-data";

test.describe("Product Management", () => {
  test("should display products list page", async ({ authenticatedPage: page }) => {
    await page.goto("/products");

    // Check page title
    await expect(page.locator("h1, h2")).toContainText(/products/i);

    // Check for table
    await expect(page.locator("table")).toBeVisible();

    // Check for key columns
    await expect(page.locator("th")).toContainText(/sku/i);
    await expect(page.locator("th")).toContainText(/name/i);
    await expect(page.locator("th")).toContainText(/price/i);
  });

  test("should search for products", async ({ authenticatedPage: page }) => {
    await page.goto("/products");

    // Search for a product
    await searchFor(page, "drill");

    // Should filter results
    const rows = page.locator("table tbody tr");
    const count = await rows.count();

    // All visible rows should contain "drill"
    if (count > 0) {
      for (let i = 0; i < Math.min(count, 5); i++) {
        const rowText = await rows.nth(i).textContent();
        expect(rowText?.toLowerCase()).toContain("drill");
      }
    }
  });

  test("should create a new product", async ({ authenticatedPage: page }) => {
    await page.goto("/products");

    const testProduct = createTestProduct({
      name: "E2E Test Product",
      category: "hand_tools",
    });

    // Click Add Product button
    await clickButton(page, /add product|new product|create/i);

    // Wait for dialog
    await waitForDialog(page, /add|create|new.*product/i);

    // Fill in product form
    await fillFieldByLabel(page, /sku/i, testProduct.sku);
    await fillFieldByLabel(page, /product name|name/i, testProduct.name);
    await fillFieldByLabel(page, /price/i, testProduct.price.toString());
    await fillFieldByLabel(page, /stock/i, testProduct.stock.toString());

    // Select category if dropdown exists
    const categorySelect = page.getByLabel(/category/i);
    if (await categorySelect.isVisible({ timeout: 1000 }).catch(() => false)) {
      await categorySelect.click();
      await page.getByRole("option", { name: /hand.*tools/i }).click();
    }

    // Submit form
    await clickButton(page, /create|save|add/i);

    // Should show success message
    await expectSuccessToast(page, /success|created/i);

    // Should see new product in list
    await searchFor(page, testProduct.sku);
    const row = await findTableRowByText(page, testProduct.sku);
    await expect(row).toBeVisible();
  });

  test("should edit an existing product", async ({ authenticatedPage: page }) => {
    await page.goto("/products");

    // First create a product to edit
    const testProduct = createTestProduct();

    await clickButton(page, /add product|new product/i);
    await waitForDialog(page, /add|create/i);
    await fillFieldByLabel(page, /sku/i, testProduct.sku);
    await fillFieldByLabel(page, /product name|name/i, testProduct.name);
    await fillFieldByLabel(page, /price/i, testProduct.price.toString());
    await fillFieldByLabel(page, /stock/i, testProduct.stock.toString());
    await clickButton(page, /create|save/i);
    await expectSuccessToast(page, /success|created/i);

    // Now search for and edit it
    await searchFor(page, testProduct.sku);
    const row = await findTableRowByText(page, testProduct.sku);

    // Click edit button in row
    await clickRowButton(row, /edit/i);

    // Wait for edit dialog
    await waitForDialog(page, /edit.*product/i);

    // Update product name
    const updatedName = `${testProduct.name} - Updated`;
    await fillFieldByLabel(page, /product name|name/i, updatedName);

    // Save changes
    await clickButton(page, /update|save/i);

    // Should show success message
    await expectSuccessToast(page, /success|updated/i);

    // Should see updated name in list
    await searchFor(page, testProduct.sku);
    const updatedRow = await findTableRowByText(page, updatedName);
    await expect(updatedRow).toBeVisible();
  });

  test("should deactivate a product", async ({ authenticatedPage: page }) => {
    await page.goto("/products");

    // Create a product to deactivate
    const testProduct = createTestProduct();

    await clickButton(page, /add product|new product/i);
    await waitForDialog(page, /add|create/i);
    await fillFieldByLabel(page, /sku/i, testProduct.sku);
    await fillFieldByLabel(page, /product name|name/i, testProduct.name);
    await fillFieldByLabel(page, /price/i, testProduct.price.toString());
    await fillFieldByLabel(page, /stock/i, testProduct.stock.toString());
    await clickButton(page, /create|save/i);
    await expectSuccessToast(page, /success|created/i);

    // Find the product
    await searchFor(page, testProduct.sku);
    const row = await findTableRowByText(page, testProduct.sku);

    // Click delete/deactivate button
    await clickRowButton(row, /delete|deactivate|remove/i);

    // Confirm deletion
    await confirmDeletion(page);

    // Should show success message
    await expectSuccessToast(page, /success|deleted|deactivated/i);

    // Product should no longer be visible (or marked as inactive)
    await searchFor(page, testProduct.sku);
    // Either row is not visible, or shows "Inactive" badge
    const searchResults = page.locator("table tbody tr");
    const count = await searchResults.count();

    if (count > 0) {
      // If product still visible, should show as inactive
      const productRow = await findTableRowByText(page, testProduct.sku);
      await expect(productRow).toContainText(/inactive/i);
    }
  });
});
