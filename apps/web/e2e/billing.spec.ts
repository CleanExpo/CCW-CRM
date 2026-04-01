/**
 * E2E tests for Billing & Subscription page
 * Tests: page load, plan display, payment methods, invoices
 */

import { test, expect } from './fixtures/auth';

test.describe('Billing Page', () => {
  test('should display billing page with plan info', async ({ authenticatedPage: page }) => {
    await page.goto('/settings/billing');

    // Check page heading
    await expect(page.locator('h1')).toContainText(/billing/i);

    // Check current plan card is visible
    await expect(page.locator('text=/current plan/i')).toBeVisible();
  });

  test('should show subscription tier and status', async ({ authenticatedPage: page }) => {
    await page.goto('/settings/billing');

    // Should show a subscription tier (starter/professional/enterprise or demo)
    await expect(page.locator('text=/starter|professional|enterprise|plan/i')).toBeVisible();

    // Should show active/trial/cancelled status badge
    await expect(page.locator('text=/active|trial|cancelled/i')).toBeVisible();
  });

  test('should show available plans section', async ({ authenticatedPage: page }) => {
    await page.goto('/settings/billing');

    // Should show available plans heading
    await expect(page.locator('text=/available plans/i')).toBeVisible();
  });

  test('should show usage and limits section', async ({ authenticatedPage: page }) => {
    await page.goto('/settings/billing');

    // Should show usage metrics
    await expect(page.locator('text=/usage|limits/i')).toBeVisible();
  });

  test('should show payment methods section', async ({ authenticatedPage: page }) => {
    await page.goto('/settings/billing');

    // Should show payment methods card
    await expect(page.locator('text=/payment method|credit card|card/i')).toBeVisible();
  });

  test('should show invoices section', async ({ authenticatedPage: page }) => {
    await page.goto('/settings/billing');

    // Should show billing history/invoices section
    await expect(page.locator('text=/invoice|billing history|receipt/i')).toBeVisible();
  });
});
