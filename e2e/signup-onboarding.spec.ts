import { expect, test, type Page } from '@playwright/test';
import { isIgnorableConsoleError } from './routes';

/**
 * Phill/Toby journey: marketing → register → onboarding → dashboard →
 * rename → password change → sign out → sign in.
 *
 * Never skips. Closed registration or a dead database fails this file.
 */
const CLOSED_MESSAGE =
  'Public registration is closed (ALLOW_PUBLIC_REGISTRATION is not true). This journey cannot run.';
const DB_MESSAGE =
  'Registration could not reach the database (503 or similar). This journey cannot run.';

async function assertRegistrationOpen(page: Page) {
  const probe = await page.request.post('/api/auth/register', {
    data: {
      email: `probe-${Date.now()}@example.invalid`,
      password: 'ProbePassword12',
      full_name: 'Probe',
    },
    failOnStatusCode: false,
  });
  if (probe.status() === 403) {
    throw new Error(CLOSED_MESSAGE);
  }
  if (probe.status() === 503 || probe.status() >= 500) {
    throw new Error(`${DB_MESSAGE} HTTP ${probe.status()}`);
  }
}

test.describe('signup onboarding account', () => {
  test('fresh email through onboarding, profile, and password change', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && !isIgnorableConsoleError(message.text())) {
        consoleErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => consoleErrors.push(`uncaught: ${error.message}`));

    await assertRegistrationOpen(page);

    const stamp = Date.now();
    const email = `e2e.signup.${stamp}@example.com`;
    const password = `SignupPass12${stamp.toString().slice(-4)}`;
    const nextPassword = `SignupNext12${stamp.toString().slice(-4)}`;
    const firstName = `E2E First ${stamp}`;
    const nextName = `E2E Next ${stamp}`;

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const signup = page.getByTestId('marketing-signup-hero').or(page.getByTestId('marketing-signup'));
    await expect(signup.first()).toBeVisible();
    await signup.first().click();
    await expect(page).toHaveURL(/\/register/);

    if (await page.getByTestId('registration-closed').count()) {
      throw new Error(CLOSED_MESSAGE);
    }

    await page.getByTestId('register-name').fill(firstName);
    await page.getByTestId('register-email').fill(email);
    await page.getByTestId('register-password').fill(password);
    await page.getByTestId('register-confirm').fill(password);
    await page.getByTestId('register-submit').click();

    await expect(page).toHaveURL(/\/onboarding/, { timeout: 20_000 });
    await expect(page.getByText(/error/i)).toHaveCount(0);

    await page.getByTestId('onboarding-company-name').fill('E2E Workshop Co');
    await page.getByLabel('Industry').click();
    await page.getByRole('option', { name: 'Equipment Supplier' }).click();
    await page.getByLabel('Company Size').click();
    await page.getByRole('option', { name: '1-10 employees' }).click();
    await page.getByTestId('onboarding-company-continue').click();
    await page.getByTestId('finish-onboarding').click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByTestId('signed-in-name')).toContainText(firstName, { timeout: 15_000 });

    await page.getByTestId('nav-account-settings').click();
    await expect(page).toHaveURL(/\/settings\/account/);
    await page.getByTestId('account-full-name').fill(nextName);
    await page.getByTestId('account-save-profile').click();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('account-full-name')).toHaveValue(nextName);

    await page.getByTestId('account-current-password').fill(password);
    await page.getByTestId('account-new-password').fill(nextPassword);
    await page.getByTestId('account-confirm-password').fill(nextPassword);
    await page.getByTestId('account-change-password').click();

    await page.getByRole('button', { name: /log out/i }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.getByTestId('login-email').fill(email);
    await page.getByTestId('login-password').fill(nextPassword);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  });
});
