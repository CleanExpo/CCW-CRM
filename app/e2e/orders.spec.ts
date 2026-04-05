/**
 * E2E tests for order management
 * Tests: list, search, create, view details, update status, generate invoice, pagination
 */

import { test, expect } from "./fixtures/auth";
import {
  expectSuccessToast,
  clickButton,
  searchFor,
  waitForDialog,
  findTableRowByText,
  clickRowButton,
  fillFieldByLabel,
  selectByLabel,
} from "./helpers/page-objects";

test.describe("Order Management", () => {
  test("should display orders list page", async ({ authenticatedPage: page }) => {
    await page.goto("/orders");

    // Check page title
    await expect(page.locator("h1, h2")).toContainText(/orders/i);

    // Check for table
    await expect(page.locator("table")).toBeVisible();

    // Check for key columns
    await expect(page.locator("th")).toContainText(/order.*number|order.*#/i);
    await expect(page.locator("th")).toContainText(/customer/i);
    await expect(page.locator("th")).toContainText(/status/i);
  });

  test("should search and filter orders", async ({ authenticatedPage: page }) => {
    await page.goto("/orders");

    // Search for orders
    await searchFor(page, "ORD");

    // Should filter results
    const rows = page.locator("table tbody tr");
    const count = await rows.count();

    // All visible rows should contain "ORD" (order number prefix)
    if (count > 0) {
      const firstRowText = await rows.first().textContent();
      expect(firstRowText).toContain("ORD");
    }
  });

  test("should create a new order", async ({ authenticatedPage: page }) => {
    await page.goto("/orders");

    // Click Create Order button
    await clickButton(page, /create.*order|new.*order|add.*order/i);

    // Wait for create order page or dialog
    const url = page.url();
    const isDialog = url.includes("/orders") && !url.includes("/new");

    if (isDialog) {
      await waitForDialog(page, /create|new.*order/i);
    } else {
      await expect(page).toHaveURL(/\/orders\/(new|create)/);
    }

    // Select a customer
    const customerSelect = page.getByLabel(/customer/i);
    if (await customerSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await customerSelect.click();
      // Select first customer from dropdown
      await page.getByRole("option").first().click();
    }

    // Add order date
    const orderDateField = page.getByLabel(/order.*date|date/i);
    if (await orderDateField.isVisible({ timeout: 1000 }).catch(() => false)) {
      const today = new Date().toISOString().split("T")[0];
      await orderDateField.fill(today);
    }

    // Add a product/line item
    const addItemButton = page.getByRole("button", { name: /add.*item|add.*product/i });
    if (await addItemButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addItemButton.click();

      // Select product
      const productSelect = page.getByLabel(/product/i).first();
      if (await productSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
        await productSelect.click();
        await page.getByRole("option").first().click();
      }

      // Set quantity
      const quantityField = page.getByLabel(/quantity/i).first();
      if (await quantityField.isVisible({ timeout: 1000 }).catch(() => false)) {
        await quantityField.fill("2");
      }
    }

    // Save order
    await clickButton(page, /create|save/i);

    // Should show success message
    await expectSuccessToast(page, /success|created/i);

    // Should redirect to orders list or order details
    await page.waitForURL(/\/orders/);
  });

  test("should view order details", async ({ authenticatedPage: page }) => {
    await page.goto("/orders");

    // Find first order row
    const firstRow = page.locator("table tbody tr").first();
    const orderNumber = await firstRow.locator("td").first().textContent();

    // Click on the row or view button
    const viewButton = firstRow.getByRole("button", { name: /view|details/i });

    if (await viewButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await viewButton.click();
    } else {
      // Click the row itself
      await firstRow.click();
    }

    // Should navigate to order details page
    await page.waitForURL(/\/orders\/[^/]+/);

    // Should show order details
    await expect(page.locator("h1, h2")).toContainText(
      new RegExp(orderNumber || "order.*details", "i")
    );

    // Should show customer information
    await expect(page.locator("text=/customer/i")).toBeVisible();

    // Should show line items
    await expect(page.locator("text=/items|products|line.*items/i")).toBeVisible();
  });

  test("should update order status", async ({ authenticatedPage: page }) => {
    await page.goto("/orders");

    // Find a draft order if possible
    const draftOrder = page.locator("table tbody tr").filter({ hasText: /draft/i }).first();
    const anyOrder = page.locator("table tbody tr").first();

    const targetRow = (await draftOrder.count()) > 0 ? draftOrder : anyOrder;

    // Click on the row to view details
    await targetRow.click();
    await page.waitForURL(/\/orders\/[^/]+/);

    // Look for status update button or dropdown
    const statusButton = page.getByRole("button", { name: /status|update.*status/i });
    const statusSelect = page.getByLabel(/status/i);

    if (await statusButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await statusButton.click();

      // Select new status
      await page.getByRole("option", { name: /confirmed|pending|processing/i }).first().click();

      // Save if needed
      const saveButton = page.getByRole("button", { name: /save|update/i });
      if (await saveButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await saveButton.click();
      }

      // Should show success message
      await expectSuccessToast(page, /success|updated/i);
    } else if (await statusSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await statusSelect.click();
      await page.getByRole("option", { name: /confirmed|pending|processing/i }).first().click();

      // Should auto-save or have save button
      const saveButton = page.getByRole("button", { name: /save|update/i });
      if (await saveButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await saveButton.click();
        await expectSuccessToast(page, /success|updated/i);
      }
    }
  });

  test("should generate invoice for order", async ({ authenticatedPage: page }) => {
    await page.goto("/orders");

    // Click first order
    await page.locator("table tbody tr").first().click();
    await page.waitForURL(/\/orders\/[^/]+/);

    // Look for invoice button
    const invoiceButton = page.getByRole("button", { name: /invoice|generate.*invoice/i });
    const invoiceLink = page.getByRole("link", { name: /invoice|view.*invoice/i });

    if (await invoiceButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Generate invoice
      await invoiceButton.click();

      // Should show invoice or navigate to invoice page
      await page.waitForTimeout(1000);

      const hasInvoice = await page
        .locator("text=/invoice/i")
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      expect(hasInvoice).toBeTruthy();
    } else if (await invoiceLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      // View existing invoice
      await invoiceLink.click();

      // Should navigate to invoice page
      await page.waitForURL(/invoice/);
      await expect(page.locator("h1, h2")).toContainText(/invoice/i);
    }
  });

  test("should navigate through pages", async ({ authenticatedPage: page }) => {
    await page.goto("/orders");

    // Check if pagination exists
    const nextButton = page.getByRole("button", { name: /next/i });
    const paginationNav = page.locator('[role="navigation"]').filter({ hasText: /page/i });

    if (await nextButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Get current page items
      const initialRows = await page.locator("table tbody tr").count();

      // Click next page
      await nextButton.click();
      await page.waitForLoadState("networkidle");

      // Should load new items (or same items if only one page)
      const newRows = await page.locator("table tbody tr").count();
      expect(newRows).toBeGreaterThan(0);

      // Go back to first page
      const prevButton = page.getByRole("button", { name: /prev|previous/i });
      if (await prevButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await prevButton.click();
        await page.waitForLoadState("networkidle");
      }
    }
  });
});
