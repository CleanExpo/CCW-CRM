import { test, expect } from '@playwright/test';

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3005';

test('debug orders page error', async ({ page }) => {
  // Login first
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', 'admin@demo.com');
  await page.fill('input[name="password"]', 'demo123');

  // Click submit and wait for response
  await page.click('button[type="submit"]');

  // Wait a bit for the API call to complete
  await page.waitForTimeout(2000);

  console.log('After submit URL:', page.url());

  // Check cookies
  const cookies = await page.context().cookies();
  console.log(
    'Cookies after login:',
    cookies.map((c) => `${c.name}@${c.domain}`)
  );

  // Wait for navigation if it happens
  await page.waitForLoadState('networkidle');

  // Navigate to dashboard to confirm auth works
  await page.goto(`${BASE_URL}/dashboard`);
  await page.waitForLoadState('networkidle');

  console.log('Dashboard URL:', page.url());
  const dashboardTitle = await page.title();
  console.log('Dashboard title:', dashboardTitle);

  // Now try to go to orders
  await page.goto(`${BASE_URL}/orders`);
  await page.waitForLoadState('networkidle');

  console.log('Orders URL:', page.url());
  const ordersTitle = await page.title();
  console.log('Orders title:', ordersTitle);

  // Check for error message
  const errorHeading = page.locator('h2');
  const errorText = await errorHeading.allTextContents();
  console.log('Page headings:', errorText);

  // Get all button text
  const buttons = page.locator('button');
  const buttonTexts = await buttons.allTextContents();
  console.log('Buttons found:', buttonTexts);

  // Take a screenshot
  await page.screenshot({ path: 'test-results/orders-page-debug.png', fullPage: true });
});
