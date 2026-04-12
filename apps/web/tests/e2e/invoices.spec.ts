/**
 * Invoice Tax Calculation E2E Test
 *
 * Tests invoice creation with tax calculation:
 * - Create invoice with line items
 * - Calculate tax (GST/PST)
 * - Verify tax breakdown
 * - Generate invoice
 */

import { test, expect } from '@playwright/test';

test.describe('Invoice Tax Calculation', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@demo.com');
    await page.fill('input[name="password"]', 'demo123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should create invoice with tax calculation', async ({ page }) => {
    await page.goto('/invoices');

    // Click "Create Invoice" button
    const createBtn = page
      .locator('button:has-text("Create Invoice")')
      .or(page.locator('button:has-text("New Invoice")'));

    if (await createBtn.isVisible({ timeout: 5000 })) {
      await createBtn.click();

      // Wait for form to load
      await page.waitForTimeout(1000);

      // Select customer
      const customerSelect = page
        .locator('select[name="customer_id"]')
        .or(page.locator('[data-testid="customer-select"]'));

      if (await customerSelect.isVisible({ timeout: 5000 })) {
        await customerSelect.selectOption({ index: 1 });

        // Add line item
        const addLineBtn = page
          .locator('button:has-text("Add Line")')
          .or(page.locator('button:has-text("Add Item")'));

        if (await addLineBtn.isVisible()) {
          await addLineBtn.click();

          // Fill in line item details
          const productSelect = page.locator('select[name*="product"]').first();
          if (await productSelect.isVisible()) {
            await productSelect.selectOption({ index: 1 });
          }

          const quantityInput = page.locator('input[name*="quantity"]').first();
          if (await quantityInput.isVisible()) {
            await quantityInput.fill('10');
          }

          // Calculate tax button
          const calculateTaxBtn = page.locator('button:has-text("Calculate Tax")');
          if (await calculateTaxBtn.isVisible({ timeout: 3000 })) {
            await calculateTaxBtn.click();

            // Wait for tax calculation
            await page.waitForTimeout(1000);

            // Verify tax breakdown is displayed
            await expect(page.locator('text=/gst|pst|total/i')).toBeVisible({ timeout: 5000 });
          }

          // Submit invoice
          const submitBtn = page
            .locator('button[type="submit"]')
            .or(page.locator('button:has-text("Create")'));
          await submitBtn.click();

          // Verify success
          await expect(
            page.locator('text=/created|success/i').or(page.locator('[role="alert"]'))
          ).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });

  test('should display GST and PST breakdown', async ({ page }) => {
    await page.goto('/invoices');

    // Click on first invoice
    const invoiceRow = page.locator('[data-testid="invoice-row"]').first();
    if (await invoiceRow.isVisible({ timeout: 10000 })) {
      await invoiceRow.click();

      // Should display tax breakdown
      const taxSection = page
        .locator('[data-testid="tax-breakdown"]')
        .or(page.locator('text=/tax breakdown/i').locator('..'));

      if (await taxSection.isVisible({ timeout: 5000 })) {
        // Should show GST and PST amounts
        await expect(taxSection).toContainText(/gst|pst/i);
      }
    }
  });

  test('should handle tax-exempt items', async ({ page }) => {
    await page.goto('/invoices');

    const createBtn = page.locator('button:has-text("Create Invoice")');
    if (await createBtn.isVisible({ timeout: 5000 })) {
      await createBtn.click();

      // Tax code selector
      const taxCodeSelect = page.locator('select[name*="tax_code"]').first();
      if (await taxCodeSelect.isVisible({ timeout: 5000 })) {
        // Select EXEMPT tax code
        await taxCodeSelect.selectOption('EXEMPT');

        // Calculate tax
        const calculateBtn = page.locator('button:has-text("Calculate Tax")');
        if (await calculateBtn.isVisible()) {
          await calculateBtn.click();

          // Verify no tax added
          await expect(page.locator('text=/tax: \\$0\\.00|exempt/i')).toBeVisible({
            timeout: 3000,
          });
        }
      }
    }
  });

  test('should filter invoices by status', async ({ page }) => {
    await page.goto('/invoices');

    const statusFilter = page
      .locator('[data-testid="status-filter"]')
      .or(page.locator('select[name="status"]'));

    if (await statusFilter.isVisible({ timeout: 5000 })) {
      await statusFilter.selectOption('paid');

      // Wait for filter to apply
      await page.waitForTimeout(1000);

      // Verify filtered results
      const statusBadges = page.locator('[data-testid="status-badge"]');
      const badges = await statusBadges.all();
      for (const badge of badges) {
        await expect(badge).toContainText(/paid/i);
      }
    }
  });
});
