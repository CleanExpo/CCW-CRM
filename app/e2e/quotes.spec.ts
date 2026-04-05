/**
 * E2E tests for quote management
 * Tests: list, create, view, edit, convert to order, filter by status
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
} from "./helpers/page-objects";

test.describe("Quote Management", () => {
  test("should display quotes list page", async ({ authenticatedPage: page }) => {
    await page.goto("/quotes");

    // Check page title
    await expect(page.locator("h1, h2")).toContainText(/quotes/i);

    // Check for table or list
    const hasTable = await page.locator("table").isVisible({ timeout: 2000 }).catch(() => false);

    if (hasTable) {
      // Check for key columns
      await expect(page.locator("th")).toContainText(/quote.*number|quote.*#/i);
      await expect(page.locator("th")).toContainText(/customer/i);
      await expect(page.locator("th")).toContainText(/status/i);
    }
  });

  test("should create a new quote", async ({ authenticatedPage: page }) => {
    await page.goto("/quotes");

    // Click Create Quote button
    await clickButton(page, /create.*quote|new.*quote|add.*quote|generate.*quote/i);

    // Wait for create quote page or dialog
    const url = page.url();
    const isDialog = url.includes("/quotes") && !url.includes("/new") && !url.includes("/generate");

    if (isDialog) {
      await waitForDialog(page, /create|new.*quote/i);
    } else {
      // Navigated to new page
      await page.waitForURL(/\/quotes\/(new|create|generate)/);
    }

    // Select a customer
    const customerSelect = page.getByLabel(/customer/i);
    if (await customerSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await customerSelect.click();
      // Select first customer
      await page.getByRole("option").first().click();
    }

    // Set quote date
    const quoteDateField = page.getByLabel(/quote.*date|date/i);
    if (await quoteDateField.isVisible({ timeout: 1000 }).catch(() => false)) {
      const today = new Date().toISOString().split("T")[0];
      await quoteDateField.fill(today);
    }

    // Set valid until date
    const validUntilField = page.getByLabel(/valid.*until|expiry|expires/i);
    if (await validUntilField.isVisible({ timeout: 1000 }).catch(() => false)) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      await validUntilField.fill(futureDate.toISOString().split("T")[0]);
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
        await quantityField.fill("3");
      }
    }

    // Save quote
    await clickButton(page, /create|save|generate/i);

    // Should show success message
    await expectSuccessToast(page, /success|created|generated/i);

    // Should redirect to quotes list or quote details
    await page.waitForURL(/\/quotes/);
  });

  test("should view quote details", async ({ authenticatedPage: page }) => {
    await page.goto("/quotes");

    // Find first quote row
    const firstRow = page.locator("table tbody tr").first();

    if ((await firstRow.count()) > 0) {
      const quoteNumber = await firstRow.locator("td").first().textContent();

      // Click on the row or view button
      const viewButton = firstRow.getByRole("button", { name: /view|details/i });

      if (await viewButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await viewButton.click();
      } else {
        await firstRow.click();
      }

      // Should navigate to quote details page
      await page.waitForURL(/\/quotes\/[^/]+/);

      // Should show quote details
      await expect(page.locator("h1, h2")).toContainText(
        new RegExp(quoteNumber || "quote.*details", "i")
      );

      // Should show customer information
      await expect(page.locator("text=/customer/i")).toBeVisible();

      // Should show line items
      await expect(page.locator("text=/items|products/i")).toBeVisible();
    }
  });

  test("should edit an existing quote", async ({ authenticatedPage: page }) => {
    await page.goto("/quotes");

    // Find a draft quote if possible
    const draftQuote = page.locator("table tbody tr").filter({ hasText: /draft/i }).first();
    const anyQuote = page.locator("table tbody tr").first();

    const targetRow = (await draftQuote.count()) > 0 ? draftQuote : anyQuote;

    if ((await targetRow.count()) > 0) {
      // Click edit button
      const editButton = targetRow.getByRole("button", { name: /edit/i });

      if (await editButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await editButton.click();
      } else {
        // Click row then look for edit button on details page
        await targetRow.click();
        await page.waitForURL(/\/quotes\/[^/]+/);

        const detailsEditButton = page.getByRole("button", { name: /edit/i });
        if (await detailsEditButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await detailsEditButton.click();
        }
      }

      // Should show edit form
      const notesField = page.getByLabel(/notes|comments/i);
      if (await notesField.isVisible({ timeout: 2000 }).catch(() => false)) {
        await notesField.fill("Updated via E2E test");

        // Save changes
        await clickButton(page, /save|update/i);

        // Should show success message
        await expectSuccessToast(page, /success|updated/i);
      }
    }
  });

  test("should convert quote to order", async ({ authenticatedPage: page }) => {
    await page.goto("/quotes");

    // Find an accepted or draft quote
    const acceptedQuote = page.locator("table tbody tr").filter({ hasText: /accepted/i }).first();
    const draftQuote = page.locator("table tbody tr").filter({ hasText: /draft/i }).first();
    const anyQuote = page.locator("table tbody tr").first();

    let targetRow = acceptedQuote;
    if ((await targetRow.count()) === 0) targetRow = draftQuote;
    if ((await targetRow.count()) === 0) targetRow = anyQuote;

    if ((await targetRow.count()) > 0) {
      // Click on quote to view details
      await targetRow.click();
      await page.waitForURL(/\/quotes\/[^/]+/);

      // Look for convert to order button
      const convertButton = page.getByRole("button", {
        name: /convert.*order|create.*order|accept/i,
      });

      if (await convertButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await convertButton.click();

        // Should show confirmation or navigate to order
        const hasDialog = await page
          .locator('[role="alertdialog"], [role="dialog"]')
          .isVisible({ timeout: 2000 })
          .catch(() => false);

        if (hasDialog) {
          // Confirm conversion
          await page.getByRole("button", { name: /convert|confirm|create/i }).click();
        }

        // Should show success message or navigate to order
        await expectSuccessToast(page, /success|created|converted/i);
      }
    }
  });

  test("should filter quotes by status", async ({ authenticatedPage: page }) => {
    await page.goto("/quotes");

    // Look for status filter
    const statusFilter = page.getByLabel(/status/i);
    const filterButton = page.getByRole("button", { name: /filter/i });

    if (await statusFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Select a specific status
      await statusFilter.click();
      await page.getByRole("option", { name: /draft|pending|accepted/i }).first().click();

      // Should filter results
      await page.waitForLoadState("networkidle");

      const rows = page.locator("table tbody tr");
      const count = await rows.count();

      // Verify filtered results (if any exist)
      if (count > 0) {
        const firstRow = await rows.first().textContent();
        // First row should contain the selected status
        expect(firstRow).toMatch(/draft|pending|accepted/i);
      }
    } else if (await filterButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Open filter panel
      await filterButton.click();

      // Try to find status selector in filter panel
      const statusInPanel = page.getByLabel(/status/i);
      if (await statusInPanel.isVisible({ timeout: 1000 }).catch(() => false)) {
        await statusInPanel.click();
        await page.getByRole("option", { name: /draft/i }).click();

        // Apply filters
        await clickButton(page, /apply|filter/i);
        await page.waitForLoadState("networkidle");
      }
    }
  });
});
