/**
 * Captures CCW ERP application screenshots for Remotion videos
 * Usage: node scripts/capture-ccw-screenshots.js
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '../video/remotion/public/images');

const BASE_URL = 'https://ccw-crm-web.vercel.app';
const EMAIL = 'admin@demo.com';
const PASSWORD = 'demo123';

const PAGES = [
  { name: 'dashboard', url: '/dashboard' },
  { name: 'orders', url: '/orders' },
  { name: 'products', url: '/products' },
  { name: 'customers', url: '/customers' },
  { name: 'quotes', url: '/quotes' },
  { name: 'invoices', url: '/invoices' },
  { name: 'ai-assistant', url: '/ai-assistant' },
  { name: 'integrations', url: '/dashboard/settings/integrations' },
  { name: 'inventory-overview', url: '/inventory-overview' },
  { name: 'purchase-orders', url: '/purchase-orders' },
];

async function captureScreenshots() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`Output: ${OUTPUT_DIR}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 810 },
  });
  const page = await context.newPage();

  // Sign in
  console.log('Signing in...');
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  console.log('Signed in successfully');

  // Capture each page
  for (const { name, url } of PAGES) {
    try {
      console.log(`Capturing ${name}...`);
      await page.goto(`${BASE_URL}${url}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(3000); // Let data load + animations settle
      const path = join(OUTPUT_DIR, `${name}.png`);
      await page.screenshot({ path, fullPage: false });
      console.log(`  ✓ ${name}.png`);
    } catch (err) {
      console.error(`  ✗ ${name}: ${err.message}`);
    }
  }

  await browser.close();
  console.log('\nDone! All screenshots saved to:', OUTPUT_DIR);
}

captureScreenshots().catch(console.error);
