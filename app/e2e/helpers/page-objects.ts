/**
 * Page object helpers for common UI interactions
 * Provides reusable functions for E2E tests
 */

import { expect, type Page, type Locator } from "@playwright/test";

/**
 * Wait for and verify success toast message
 */
export async function expectSuccessToast(page: Page, message: string | RegExp) {
  const toast = page.locator('[role="status"], [role="alert"]').filter({ hasText: message });
  await expect(toast).toBeVisible({ timeout: 5000 });
}

/**
 * Wait for and verify error toast message
 */
export async function expectErrorToast(page: Page, message: string | RegExp) {
  const toast = page.locator('[role="status"], [role="alert"]').filter({ hasText: message });
  await expect(toast).toBeVisible({ timeout: 5000 });
}

/**
 * Fill a form field by label
 */
export async function fillFieldByLabel(page: Page, label: string | RegExp, value: string) {
  const field = page.getByLabel(label);
  await field.fill(value);
}

/**
 * Select an option from a select dropdown by label
 */
export async function selectByLabel(page: Page, label: string | RegExp, option: string) {
  const select = page.getByLabel(label);
  await select.click();
  await page.getByRole("option", { name: option }).click();
}

/**
 * Click a button by text
 */
export async function clickButton(page: Page, text: string | RegExp) {
  const button = page.getByRole("button", { name: text });
  await button.click();
}

/**
 * Navigate to a dashboard page
 */
export async function navigateTo(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

/**
 * Search in a table/list
 */
export async function searchFor(page: Page, query: string) {
  const searchInput = page.getByPlaceholder(/search/i);
  await searchInput.fill(query);
  await page.waitForLoadState("networkidle");
}

/**
 * Wait for table to load and return row count
 */
export async function getTableRowCount(page: Page): Promise<number> {
  await page.waitForSelector("table tbody tr");
  const rows = await page.locator("table tbody tr").count();
  return rows;
}

/**
 * Click the first row in a table
 */
export async function clickFirstTableRow(page: Page) {
  const firstRow = page.locator("table tbody tr").first();
  await firstRow.click();
}

/**
 * Find a table row by text content
 */
export async function findTableRowByText(page: Page, text: string): Promise<Locator> {
  return page.locator("table tbody tr").filter({ hasText: text });
}

/**
 * Click a button in a specific table row
 */
export async function clickRowButton(row: Locator, buttonName: string | RegExp) {
  const button = row.getByRole("button", { name: buttonName });
  await button.click();
}

/**
 * Wait for dialog to appear
 */
export async function waitForDialog(page: Page, title: string | RegExp) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading")).toContainText(title);
  return dialog;
}

/**
 * Close dialog
 */
export async function closeDialog(page: Page) {
  // Try clicking Cancel button first
  const cancelButton = page.getByRole("button", { name: /cancel/i });
  if (await cancelButton.isVisible()) {
    await cancelButton.click();
  } else {
    // Try close button
    const closeButton = page.getByRole("button", { name: /close/i });
    await closeButton.click();
  }
  await expect(page.getByRole("dialog")).not.toBeVisible();
}

/**
 * Fill a product form
 */
export async function fillProductForm(page: Page, product: {
  sku: string;
  name: string;
  price: number;
  stock: number;
  category?: string;
}) {
  await fillFieldByLabel(page, /sku/i, product.sku);
  await fillFieldByLabel(page, /product name/i, product.name);
  await fillFieldByLabel(page, /price/i, product.price.toString());
  await fillFieldByLabel(page, /stock/i, product.stock.toString());

  if (product.category) {
    await selectByLabel(page, /category/i, product.category);
  }
}

/**
 * Fill a customer form
 */
export async function fillCustomerForm(page: Page, customer: {
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string;
}) {
  await fillFieldByLabel(page, /company name/i, customer.company_name);
  await fillFieldByLabel(page, /contact name/i, customer.contact_name);
  await fillFieldByLabel(page, /email/i, customer.email);

  if (customer.phone) {
    await fillFieldByLabel(page, /phone/i, customer.phone);
  }
}

/**
 * Confirm deletion in alert dialog
 */
export async function confirmDeletion(page: Page) {
  const alertDialog = page.locator('[role="alertdialog"]');
  await expect(alertDialog).toBeVisible();
  const deleteButton = alertDialog.getByRole("button", { name: /delete|confirm/i });
  await deleteButton.click();
  await expect(alertDialog).not.toBeVisible();
}

/**
 * Cancel deletion in alert dialog
 */
export async function cancelDeletion(page: Page) {
  const alertDialog = page.locator('[role="alertdialog"]');
  await expect(alertDialog).toBeVisible();
  const cancelButton = alertDialog.getByRole("button", { name: /cancel/i });
  await cancelButton.click();
  await expect(alertDialog).not.toBeVisible();
}

/**
 * Wait for loading to complete
 */
export async function waitForLoading(page: Page) {
  // Wait for loading spinner to disappear
  const spinner = page.locator('[role="status"]').filter({ hasText: /loading/i });
  if (await spinner.isVisible({ timeout: 1000 }).catch(() => false)) {
    await expect(spinner).not.toBeVisible({ timeout: 10000 });
  }
  await page.waitForLoadState("networkidle");
}

/**
 * Check if element is in viewport
 */
export async function scrollIntoView(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
}
