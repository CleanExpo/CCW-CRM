/**
 * E2E tests for customer management
 * Tests: list, create, edit, search
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
} from "./helpers/page-objects";
import { createTestCustomer } from "./helpers/test-data";

test.describe("Customer Management", () => {
  test("should display customers list page", async ({ authenticatedPage: page }) => {
    await page.goto("/customers");

    // Check page title
    await expect(page.locator("h1, h2")).toContainText(/customers/i);

    // Check for table or customer list
    const hasTable = await page.locator("table").isVisible({ timeout: 2000 }).catch(() => false);
    const hasCards = await page
      .locator('[data-testid="customer-card"], .customer-card')
      .count()
      .then((count) => count > 0)
      .catch(() => false);

    expect(hasTable || hasCards).toBeTruthy();
  });

  test("should create a new customer", async ({ authenticatedPage: page }) => {
    await page.goto("/customers");

    const testCustomer = createTestCustomer();

    // Click Add Customer button
    await clickButton(page, /add customer|new customer|create/i);

    // Wait for dialog
    await waitForDialog(page, /add|create|new.*customer/i);

    // Fill in customer form
    await fillFieldByLabel(page, /company name/i, testCustomer.company_name);
    await fillFieldByLabel(page, /contact name/i, testCustomer.contact_name);
    await fillFieldByLabel(page, /email/i, testCustomer.email);
    await fillFieldByLabel(page, /phone/i, testCustomer.phone);

    // Fill optional address fields if present
    const addressField = page.getByLabel(/address/i);
    if (await addressField.isVisible({ timeout: 1000 }).catch(() => false)) {
      await addressField.fill(testCustomer.address);
    }

    const cityField = page.getByLabel(/city/i);
    if (await cityField.isVisible({ timeout: 1000 }).catch(() => false)) {
      await cityField.fill(testCustomer.city);
    }

    // Submit form
    await clickButton(page, /create|save|add/i);

    // Should show success message
    await expectSuccessToast(page, /success|created/i);

    // Should see new customer in list
    await searchFor(page, testCustomer.company_name);
    const customerLocator = page.locator(`text=${testCustomer.company_name}`);
    await expect(customerLocator).toBeVisible();
  });

  test("should edit an existing customer", async ({ authenticatedPage: page }) => {
    await page.goto("/customers");

    // First create a customer to edit
    const testCustomer = createTestCustomer();

    await clickButton(page, /add customer|new customer/i);
    await waitForDialog(page, /add|create/i);
    await fillFieldByLabel(page, /company name/i, testCustomer.company_name);
    await fillFieldByLabel(page, /contact name/i, testCustomer.contact_name);
    await fillFieldByLabel(page, /email/i, testCustomer.email);
    await fillFieldByLabel(page, /phone/i, testCustomer.phone);
    await clickButton(page, /create|save/i);
    await expectSuccessToast(page, /success|created/i);

    // Search for the customer
    await searchFor(page, testCustomer.company_name);

    // Find and click edit button
    // Check if using table or card layout
    const hasTable = await page.locator("table").isVisible({ timeout: 1000 }).catch(() => false);

    if (hasTable) {
      const row = await findTableRowByText(page, testCustomer.company_name);
      await clickRowButton(row, /edit/i);
    } else {
      // Card layout - find edit button near company name
      const customerCard = page.locator(`text=${testCustomer.company_name}`).locator("..");
      const editButton = customerCard.getByRole("button", { name: /edit/i });
      await editButton.click();
    }

    // Wait for edit dialog
    await waitForDialog(page, /edit.*customer/i);

    // Update contact name
    const updatedContactName = `${testCustomer.contact_name} - Updated`;
    await fillFieldByLabel(page, /contact name/i, updatedContactName);

    // Save changes
    await clickButton(page, /update|save/i);

    // Should show success message
    await expectSuccessToast(page, /success|updated/i);

    // Should see updated contact name
    await searchFor(page, testCustomer.company_name);
    const updatedLocator = page.locator(`text=${updatedContactName}`);
    await expect(updatedLocator).toBeVisible();
  });

  test("should search for customers", async ({ authenticatedPage: page }) => {
    await page.goto("/customers");

    // Create a unique customer for searching
    const testCustomer = createTestCustomer({
      company_name: `Unique Search Test Company ${Date.now()}`,
    });

    await clickButton(page, /add customer|new customer/i);
    await waitForDialog(page, /add|create/i);
    await fillFieldByLabel(page, /company name/i, testCustomer.company_name);
    await fillFieldByLabel(page, /contact name/i, testCustomer.contact_name);
    await fillFieldByLabel(page, /email/i, testCustomer.email);
    await fillFieldByLabel(page, /phone/i, testCustomer.phone);
    await clickButton(page, /create|save/i);
    await expectSuccessToast(page, /success|created/i);

    // Search for the customer
    await searchFor(page, "Unique Search Test");

    // Should find the customer
    const customerLocator = page.locator(`text=${testCustomer.company_name}`);
    await expect(customerLocator).toBeVisible();

    // Clear search
    await searchFor(page, "");

    // Should show more customers
    const hasTable = await page.locator("table").isVisible({ timeout: 1000 }).catch(() => false);
    if (hasTable) {
      const rows = page.locator("table tbody tr");
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
    }
  });
});
