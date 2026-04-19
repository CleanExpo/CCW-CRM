/**
 * E2E — Customer Portal view.
 *
 * Covers: portal landing, orders list, order detail expand/navigate.
 * Portal is public in demo mode (no auth redirect) so no login step is needed.
 */

import { expect, test } from '@playwright/test';

test.describe('Customer Portal', () => {
  test('portal landing renders the expected header and nav', async ({ page }) => {
    await page.goto('/portal');

    await expect(
      page
        .locator('h1, h2')
        .filter({ hasText: /portal|welcome|orders/i })
        .first()
    ).toBeVisible({ timeout: 15_000 });

    await page.screenshot({
      path: `test-results/portal-landing-${Date.now()}.png`,
      fullPage: true,
    });
  });

  test('portal orders list renders and supports order detail interaction', async ({ page }) => {
    await page.goto('/portal/orders');

    // At least the header or an "orders" label should appear even if there are zero orders.
    const hasOrdersHeader = await page
      .locator('h1, h2, [role="heading"]')
      .filter({ hasText: /orders/i })
      .first()
      .isVisible({ timeout: 10_000 })
      .catch(() => false);

    expect(hasOrdersHeader, 'portal orders view should render a heading').toBe(true);

    // Look for an order row/card. Accept common shapes: table row, card, list item.
    const firstOrder = page
      .locator('[data-testid="order-row"], [data-testid="order-card"], article, tr')
      .filter({ has: page.locator('text=/#|ORD-|Order/') })
      .first();

    const hasOrder = await firstOrder.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasOrder) {
      test.skip(true, 'Portal has no seeded orders in this environment.');
      return;
    }

    // Click the first order and assert some detail UI appears (expand inline OR navigate).
    await firstOrder.click();
    const detailVisible = await Promise.race([
      page
        .locator("table, [data-testid='order-items'], text=/line item|quantity|total/i")
        .first()
        .waitFor({ state: 'visible', timeout: 10_000 })
        .then(() => true)
        .catch(() => false),
      page
        .waitForURL(/\/portal\/orders\//, { timeout: 10_000 })
        .then(() => true)
        .catch(() => false),
    ]);

    expect(
      detailVisible,
      'clicking an order should either expand a detail section or navigate to a detail page'
    ).toBe(true);
  });
});
