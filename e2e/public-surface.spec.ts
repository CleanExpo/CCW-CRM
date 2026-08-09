import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PUBLIC_ROUTES, isIgnorableConsoleError } from './routes';

/**
 * The half of the harness that runs without a session, so it keeps working
 * while the authenticated surface is blocked.
 */
for (const route of PUBLIC_ROUTES) {
  test.describe(`public: ${route.name}`, () => {
    test(`loads without console errors`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error' && !isIgnorableConsoleError(message.text())) {
          consoleErrors.push(message.text());
        }
      });
      page.on('pageerror', (error) => consoleErrors.push(`uncaught: ${error.message}`));

      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), `${route.path} should return 200`).toBe(200);

      await page.waitForLoadState('networkidle').catch(() => {
        /* long-polling pages never idle; the console assertion below still holds */
      });

      expect(consoleErrors, `${route.path} logged console errors`).toEqual([]);
    });

    test(`has no serious or critical accessibility violations`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });

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

    // The scan above is BLIND to most of the landing page. Below-fold sections are wrapped in
    // MarketingReveal, which starts at `opacity: 0` until it intersects the viewport, and
    // axe-core treats an `opacity: 0` ancestor as hidden — so it never examines that content and
    // reports a clean page. Measured on 4717b25f: 0 violations by default, 25+ with the content
    // revealed. Under `prefers-reduced-motion` the component skips the observer and renders
    // visible immediately, which both exercises the real reduced-motion experience and gives axe
    // something to look at. Without this case a contrast regression in any revealed section ships
    // silently.
    test(`has no serious or critical accessibility violations with motion reduced`, async ({
      page,
      context,
    }) => {
      await context.clearCookies();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });

      // Scanning before hydration would defeat the entire point of this case: the reveals would
      // still be `opacity: 0`, axe would treat them as hidden, and the test would report a clean
      // page having examined nothing. `domcontentloaded` does not wait for React, so on a slow
      // runner that race is real. Wait for the component to publish its revealed state, and FAIL
      // if it never does — a gate that cannot see must say so, not pass.
      const reveals = page.locator('[data-revealed]');
      const revealCount = await reveals.count();
      if (revealCount > 0) {
        await expect(
          page.locator('[data-revealed="true"]').first(),
          `${route.path} has ${revealCount} reveal(s) but none became visible under reduced ` +
            `motion — axe would have scanned hidden content and passed vacuously`
        ).toBeAttached({ timeout: 15_000 });
      }

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const blocking = results.violations.filter(
        (violation) => violation.impact === 'serious' || violation.impact === 'critical'
      );

      const summary = blocking
        .map((v) => `${v.id} (${v.impact}, ${v.nodes.length} node(s)): ${v.help}`)
        .join('\n');

      expect(
        blocking,
        `${route.path} reduced-motion accessibility violations:\n${summary}`
      ).toEqual([]);
    });

    test(`matches its visual baseline`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});
      // Settle animations before the comparison so a diff means a real change.
      await page.waitForTimeout(1_000);

      await expect(page).toHaveScreenshot(`${route.name}.png`, {
        fullPage: false,
        // Antialiasing differs between machines; a real regression moves far
        // more than this.
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      });
    });
  });
}
