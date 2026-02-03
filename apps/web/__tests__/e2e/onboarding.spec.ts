import { test, expect } from "@playwright/test";

test.describe("Onboarding Flow", () => {
  test("should complete full onboarding wizard", async ({ page }) => {
    // Navigate to signup page
    await page.goto("/signup");

    // Step 1: Signup
    await page.fill('input[name="full_name"]', "Test User");
    await page.fill('input[name="email"]', `test-${Date.now()}@example.com`);
    await page.fill('input[name="company_name"]', "Test Company");
    await page.fill('input[name="password"]', "Password123!");
    await page.click('input[name="agree_terms"]');
    await page.click('button[type="submit"]');

    // Should redirect to onboarding wizard
    await expect(page).toHaveURL("/onboarding");
    await expect(page.locator("text=Welcome to CCW ERP")).toBeVisible();

    // Step 2: Company Setup
    await expect(page.locator("text=Company Setup")).toBeVisible();
    await page.fill('input[name="company_name"]', "Test Company Inc");
    await page.selectOption('select[name="industry"]', "equipment");
    await page.selectOption('select[name="company_size"]', "1-10");
    await page.click('button:has-text("Continue")');

    // Step 3: Shopify Connect (Skip)
    await expect(page.locator("text=Connect Shopify")).toBeVisible();
    await page.click('button:has-text("Skip for Now")');

    // Step 4: Sample Data (Generate)
    await expect(page.locator("text=Sample Data")).toBeVisible();
    await page.click('button:has-text("Generate Sample Data")');
    await expect(page.locator("text=Sample Data Generated!")).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Continue")');

    // Step 5: Team Invite (Skip)
    await expect(page.locator("text=Invite Team")).toBeVisible();
    await page.click('button:has-text("Skip for Now")');

    // Step 6: First Quote
    await expect(page.locator("text=First Quote")).toBeVisible();
    await page.fill('input[name="customer_name"]', "Acme Corp");
    await page.fill('input[name="customer_email"]', "contact@acme.com");
    await page.fill('textarea[name="description"]', "Test quote for carpet cleaning equipment");
    await page.fill('input[name="estimated_value"]', "5000");
    await page.click('button:has-text("Create Quote & Finish")');

    // Should redirect to dashboard
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
    await expect(page.locator("text=Dashboard")).toBeVisible();
  });

  test("should skip optional steps and complete onboarding", async ({ page }) => {
    // Navigate to onboarding (assuming user is already signed up)
    await page.goto("/onboarding");

    // Company Setup (required)
    await page.fill('input[name="company_name"]', "Quick Test Co");
    await page.selectOption('select[name="industry"]', "retail");
    await page.selectOption('select[name="company_size"]', "11-50");
    await page.click('button:has-text("Continue")');

    // Skip Shopify
    await page.click('button:has-text("Skip for Now")');

    // Skip Sample Data
    await page.click('button:has-text("Skip for Now")');

    // Skip Team Invite
    await page.click('button:has-text("Skip for Now")');

    // First Quote (minimal data)
    await page.fill('input[name="customer_name"]', "Test Customer");
    await page.fill('input[name="customer_email"]', "test@test.com");
    await page.fill('textarea[name="description"]', "Minimal test quote description");
    await page.click('button:has-text("Create Quote & Finish")');

    // Should complete successfully
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
  });

  test("should navigate back and forth between steps", async ({ page }) => {
    await page.goto("/onboarding");

    // Complete company setup
    await page.fill('input[name="company_name"]', "Nav Test Co");
    await page.selectOption('select[name="industry"]', "wholesale");
    await page.selectOption('select[name="company_size"]', "1-10");
    await page.click('button:has-text("Continue")');

    // At Shopify step, go back
    await page.click('button:has-text("Back")');

    // Should be back at company setup
    await expect(page.locator('input[name="company_name"]')).toHaveValue("Nav Test Co");

    // Go forward again
    await page.click('button:has-text("Continue")');

    // Skip Shopify
    await page.click('button:has-text("Skip for Now")');

    // Go back from Sample Data
    await page.click('button:has-text("Back")');

    // Should be at Shopify step
    await expect(page.locator("text=Connect Shopify")).toBeVisible();
  });
});
