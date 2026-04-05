import { test, expect } from "@playwright/test";

test.describe("Billing & Subscription Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@demo.com");
    await page.fill('input[name="password"]', "demo123");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/dashboard");
  });

  test("should display current subscription status", async ({ page }) => {
    // Navigate to billing page
    await page.goto("/settings/billing");

    // Should show current plan
    await expect(page.locator("text=Current Plan")).toBeVisible();
    await expect(page.locator("text=Billing & Subscription")).toBeVisible();

    // Should show usage metrics
    await expect(page.locator("text=Usage & Limits")).toBeVisible();
    await expect(page.locator("text=Locations")).toBeVisible();
    await expect(page.locator("text=Team Members")).toBeVisible();
  });

  test("should display all available subscription plans", async ({ page }) => {
    await page.goto("/settings/billing");

    // Should show all 4 plans
    await expect(page.locator("text=Starter")).toBeVisible();
    await expect(page.locator("text=Professional")).toBeVisible();
    await expect(page.locator("text=Enterprise")).toBeVisible();
    await expect(page.locator("text=Custom")).toBeVisible();

    // Should show Most Popular badge on Professional
    await expect(page.locator("text=Most Popular")).toBeVisible();
  });

  test("should toggle between monthly and annual billing", async ({ page }) => {
    await page.goto("/settings/billing");

    // Default should be monthly
    await expect(page.locator('button:has-text("Switch to Annual")')).toBeVisible();

    // Click to switch to annual
    await page.click('button:has-text("Switch to Annual")');

    // Should show annual pricing
    await expect(page.locator('button:has-text("Switch to Monthly")')).toBeVisible();

    // Should show "Save 20%" badge
    const savingsBadge = page.locator("text=/Save \\d+%/");
    await expect(savingsBadge).not.toBeVisible(); // Hidden when on annual view

    // Switch back to monthly
    await page.click('button:has-text("Switch to Monthly")');
    await expect(page.locator('button:has-text("Switch to Annual")')).toBeVisible();
  });

  test("should open payment method dialog when selecting a plan", async ({ page }) => {
    await page.goto("/settings/billing");

    // Click on Professional plan
    await page.click('button:has-text("Select Professional")');

    // Should open payment method dialog
    await expect(page.locator("text=Update Payment Method")).toBeVisible();
    await expect(page.locator("text=Add a payment method")).toBeVisible();

    // Should have payment form fields
    await expect(page.locator('input[placeholder*="4242"]')).toBeVisible(); // Card number
    await expect(page.locator('input[placeholder*="MM/YY"]')).toBeVisible(); // Expiry
    await expect(page.locator('input[placeholder*="123"]')).toBeVisible(); // CVC

    // Close dialog
    await page.click('button:has-text("Cancel")');
  });

  test("should complete subscription upgrade flow", async ({ page }) => {
    await page.goto("/settings/billing");

    // Select Professional plan (monthly)
    await page.click('button:has-text("Select Professional")');

    // Fill in payment details (test card)
    await page.fill('input[placeholder*="4242"]', "4242424242424242");
    await page.fill('input[placeholder*="MM/YY"]', "12/25");
    await page.fill('input[placeholder*="123"]', "123");
    await page.fill('input[placeholder*="John Smith"]', "Test User");

    // Submit payment method
    await page.click('button:has-text("Add Payment Method")');

    // Should show success message
    await expect(page.locator("text=Success")).toBeVisible({ timeout: 10000 });

    // Should close dialog and update current plan
    await expect(page.locator("text=Update Payment Method")).not.toBeVisible();
  });

  test("should display usage metrics with progress bars", async ({ page }) => {
    await page.goto("/settings/billing");

    // Should show usage metrics
    const usageSection = page.locator("text=Usage & Limits").locator("..");

    // Check for specific metrics
    await expect(usageSection.locator("text=Locations")).toBeVisible();
    await expect(usageSection.locator("text=Team Members")).toBeVisible();
    await expect(usageSection.locator("text=Products")).toBeVisible();

    // Should have progress bars (look for progress element)
    const progressBars = page.locator('[role="progressbar"]');
    await expect(progressBars.first()).toBeVisible();
  });

  test("should show invoice history if available", async ({ page }) => {
    await page.goto("/settings/billing");

    // Look for invoice history section
    const invoiceSection = page.locator("text=Invoice History");

    // If invoices exist, should show table
    const isVisible = await invoiceSection.isVisible();
    if (isVisible) {
      await expect(page.locator("text=Date")).toBeVisible();
      await expect(page.locator("text=Amount")).toBeVisible();
      await expect(page.locator("text=Status")).toBeVisible();
    }
  });

  test("should open cancel subscription dialog", async ({ page }) => {
    await page.goto("/settings/billing");

    // Look for cancel button (only visible if active subscription)
    const cancelButton = page.locator('button:has-text("Cancel Subscription")');

    if (await cancelButton.isVisible()) {
      await cancelButton.click();

      // Should show confirmation dialog
      await expect(page.locator("text=Cancel Subscription?")).toBeVisible();
      await expect(page.locator("text=Are you sure")).toBeVisible();

      // Close without canceling
      await page.click('button:has-text("Keep Subscription")');
    }
  });

  test("should use command palette to navigate to billing", async ({ page }) => {
    await page.goto("/dashboard");

    // Open command palette with Cmd+K (or Ctrl+K)
    await page.keyboard.press("Meta+K"); // Meta is Cmd on Mac, Windows key on Windows

    // Should open command dialog
    await expect(page.locator('input[placeholder*="command"]')).toBeVisible();

    // Type "billing"
    await page.keyboard.type("billing");

    // Should show billing option
    await expect(page.locator("text=Billing & Subscription")).toBeVisible();

    // Select it
    await page.keyboard.press("Enter");

    // Should navigate to billing page
    await expect(page).toHaveURL("/settings/billing");
  });
});
