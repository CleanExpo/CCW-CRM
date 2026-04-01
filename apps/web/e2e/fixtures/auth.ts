/**
 * Authentication fixture for E2E tests
 * Provides authenticated page context for tests
 */

import { test as base, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

type AuthFixtures = {
  authenticatedPage: Page;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Page will already have auth state from auth.setup.ts
    // Just navigate to dashboard to start
    await page.goto("/dashboard");

    // Verify authentication
    await expect(page.locator("h1, h2")).toContainText(/dashboard/i);

    await use(page);
  },
});

export { expect };
