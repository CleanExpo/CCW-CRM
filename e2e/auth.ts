import type { Page } from '@playwright/test';

/**
 * Credentials for the authenticated specs.
 *
 * Read from the environment only. Nothing in this repo should carry a working
 * password: docs/ and scripts/ currently print `admin@demo.com / demo123` in
 * fourteen places and it does not authenticate, which is the failure mode a
 * checked-in credential always reaches eventually.
 */
export function getCredentials(): { email: string; password: string } | null {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}

export const MISSING_CREDENTIALS_MESSAGE =
  'E2E_EMAIL and E2E_PASSWORD are not set, so the authenticated suite cannot run. ' +
  'This is a FAILURE, not a skip: the operator screens are the surface these tests exist ' +
  'to cover, and a green run that silently omitted them would be a false report.';

/**
 * Log in and land on the dashboard.
 *
 * Throws with the server's own response when login does not succeed, so a
 * failure names the cause rather than timing out on a selector. As of
 * 2026-08-07 production returns 503 "Authentication service unavailable"
 * because DATABASE_URL is not configured on the deployment — every
 * authenticated spec fails here until that is fixed, and it should say so
 * plainly rather than look like a flaky selector.
 */
export async function login(page: Page, email: string, password: string): Promise<void> {
  const loginResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/auth/login') && response.request().method() === 'POST',
    { timeout: 30_000 }
  );

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  const response = await loginResponsePromise;
  if (!response.ok()) {
    const body = await response.text().catch(() => '<unreadable>');
    throw new Error(
      `Login failed: POST /api/auth/login returned ${response.status()}. Body: ${body.slice(0, 300)}`
    );
  }

  await page.waitForURL('**/dashboard', { timeout: 30_000 });
}
