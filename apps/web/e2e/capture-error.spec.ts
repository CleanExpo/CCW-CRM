import { test } from '@playwright/test';
import { loginAsAdmin } from './test-helper';

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3005';

test('capture orders page console errors', async ({ page }) => {
  // Capture console messages
  const consoleMessages: string[] = [];
  page.on('console', (msg) => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
  });

  // Capture page errors
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(`ERROR: ${error.message}\n${error.stack}`);
  });

  // Login
  await loginAsAdmin(page, BASE_URL);

  console.log('=== Successfully logged in ===');

  // Navigate to orders page
  await page.goto(`${BASE_URL}/orders`);
  await page.waitForLoadState('networkidle');

  console.log('=== Orders Page URL:', page.url());

  // Wait a bit for any errors to appear
  await page.waitForTimeout(2000);

  // Output all console messages
  console.log('\n=== CONSOLE MESSAGES ===');
  consoleMessages.forEach((msg) => console.log(msg));

  // Output all page errors
  console.log('\n=== PAGE ERRORS ===');
  pageErrors.forEach((err) => console.log(err));

  // Check page title
  const title = await page.title();
  console.log('\n=== PAGE TITLE:', title);

  // Get page headings
  const headings = await page.locator('h1, h2').allTextContents();
  console.log('\n=== PAGE HEADINGS:', headings);
});
