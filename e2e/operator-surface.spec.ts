import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { getCredentials, login, MISSING_CREDENTIALS_MESSAGE } from './auth';
import { OPERATOR_ROUTES, AUTHED_ROUTES, isIgnorableConsoleError } from './routes';

/**
 * The operator surface — the screens the gauntlet loop judges against Shopify
 * Admin. Every spec here logs in first.
 */

const credentials = getCredentials();

test.describe('operator surface', () => {
  test('credentials are available', async () => {
    // Deliberately a failing assertion rather than test.skip(). The whole point
    // of this suite is the authenticated screens; a run that quietly omitted
    // them and reported green would be a false report.
    expect(credentials, MISSING_CREDENTIALS_MESSAGE).not.toBeNull();
  });

  test('unauthenticated access is refused', async ({ page }) => {
    // Runs without credentials — proves the harness reaches the app and that
    // the auth boundary holds, so a red authenticated suite can be attributed
    // to the session rather than to the harness being broken.
    const response = await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    expect(response?.url(), '/dashboard should redirect an anonymous client to /login').toContain(
      '/login'
    );
  });

  test.describe('authenticated', () => {
    test.beforeEach(async ({ page }) => {
      if (!credentials) throw new Error(MISSING_CREDENTIALS_MESSAGE);
      await login(page, credentials.email, credentials.password);
    });

    for (const route of [...OPERATOR_ROUTES, ...AUTHED_ROUTES]) {
      test(`${route.name} loads without console errors`, async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on('console', (message) => {
          if (message.type() === 'error' && !isIgnorableConsoleError(message.text())) {
            consoleErrors.push(message.text());
          }
        });
        page.on('pageerror', (error) => consoleErrors.push(`uncaught: ${error.message}`));

        await page.goto(route.path, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => {});

        expect(page.url(), `${route.path} bounced to login`).not.toContain('/login');
        expect(consoleErrors, `${route.path} logged console errors`).toEqual([]);
      });
    }

    for (const route of OPERATOR_ROUTES) {
      test(`${route.name} has no serious accessibility violations (bar: ${route.bar})`, async ({
        page,
      }) => {
        await page.goto(route.path, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => {});

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();

        const blocking = results.violations.filter(
          (violation) => violation.impact === 'serious' || violation.impact === 'critical'
        );
        const summary = blocking
          .map((v) => `${v.id} (${v.impact}, ${v.nodes.length} node(s)): ${v.help}`)
          .join('\n');

        expect(blocking, `${route.path} accessibility violations:\n${summary}`).toEqual([]);
      });
    }

    // NO VISUAL BASELINES FOR THE OPERATOR ROUTES YET, DELIBERATELY.
    //
    // A screenshot assertion with no committed baseline is not a test — it is a
    // guaranteed failure that reports "missing snapshot" instead of whatever is
    // actually wrong. An earlier revision of this file asserted baselines for
    // these four routes across both projects; none could be captured, because
    // the production deployment has no database and every one of these screens
    // 503s at login.
    //
    // Reinstate them in one step once login works:
    //   E2E_EMAIL=... E2E_PASSWORD=... npx playwright test --update-snapshots
    // then restore the toHaveScreenshot block here. The routes and their
    // Shopify Admin counterparts are already declared in e2e/routes.ts.
    //
    // Until then the a11y and console-error specs above still cover these
    // screens, and they fail loudly on the outage rather than quietly skipping.
  });
});
