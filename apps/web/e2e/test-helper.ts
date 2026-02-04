/**
 * E2E Test Helpers
 */

import { Page } from "@playwright/test";

/**
 * Login helper that works around cross-domain cookie issues
 * Makes the login API call directly from the browser context
 */
export async function loginAsAdmin(page: Page, baseUrl: string) {
  // Navigate to any page to establish the frontend domain
  await page.goto(`${baseUrl}/`);

  // Make login API call from browser context and set cookie manually
  await page.evaluate(async ({ backendUrl }) => {
    const response = await fetch(`${backendUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@demo.com",
        password: "demo123",
      }),
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status}`);
    }

    const data = await response.json();

    // Manually set the auth_token cookie since cross-domain cookies don't work
    document.cookie = `auth_token=${data.access_token}; path=/; max-age=28800; samesite=lax`;
  }, {
    backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000",
  });

  // Now navigate to dashboard - cookie should work
  await page.goto(`${baseUrl}/dashboard`);
  await page.waitForLoadState("networkidle");
}
