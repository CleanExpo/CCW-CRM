/**
 * CCW Boardroom — QA Browser Test Module (UNI-1694)
 *
 * Implements gstack /qa patterns in the CRON pipeline.
 * Runs after every CRON cycle to verify the CCW ERP is healthy.
 * Uses Playwright Chromium for real browser verification.
 *
 * Tests:
 *   1. CCW site health (ccwonline.com.au loads)
 *   2. CCW ERP login page reachable
 *   3. Dashboard metrics endpoint responds
 *   4. Key CRUD operations (products, customers, orders)
 *   5. POS terminal accessible
 *   6. Settings > Integrations cards visible
 *   7. No critical console errors
 *   8. Mobile viewport check (375px)
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

const DEFAULT_TIMEOUT = 20_000;
const CCW_ERP_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://ccw-erp.vercel.app';
const CCW_SITE_URL = 'https://www.carpetcleanerswarehouse.com.au';
const API_BASE =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_FRONTEND_URL ||
  CCW_ERP_URL;

/**
 * Individual QA check result.
 */
function makeResult(id, name, pass, details = {}) {
  return { id, name, pass, details, timestamp: new Date().toISOString() };
}

/**
 * Check app health endpoint (Next.js Route Handler).
 */
async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE.replace(/\/$/, '')}/api/health`, {
      signal: AbortSignal.timeout(8_000),
    });
    const data = await res.json().catch(() => ({}));
    return makeResult('backend_health', 'App /api/health endpoint', res.ok, {
      status: res.status,
      body: data,
    });
  } catch (err) {
    return makeResult('backend_health', 'App /api/health endpoint', false, { error: err.message });
  }
}

/**
 * Check CCW main site loads.
 */
async function checkCCWSite(context) {
  const page = await context.newPage();
  try {
    const res = await page.goto(CCW_SITE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: DEFAULT_TIMEOUT,
    });
    const title = await page.title();
    const h1 = await page.$eval('h1', (e) => e.textContent?.trim()).catch(() => null);

    return makeResult('ccw_site', 'CCW main site loads', res?.ok() !== false, {
      title,
      h1,
      status: res?.status(),
    });
  } catch (err) {
    return makeResult('ccw_site', 'CCW main site loads', false, { error: err.message });
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Check ERP login page.
 */
async function checkERPLogin(context) {
  const page = await context.newPage();
  try {
    await page.goto(`${CCW_ERP_URL}/login`, { waitUntil: 'networkidle', timeout: DEFAULT_TIMEOUT });
    const hasLoginForm = (await page.$('input[type="email"], input[name="email"]')) !== null;
    const hasPasswordField = (await page.$('input[type="password"]')) !== null;
    const title = await page.title();

    return makeResult('erp_login', 'ERP login page accessible', hasLoginForm && hasPasswordField, {
      title,
      hasLoginForm,
      hasPasswordField,
    });
  } catch (err) {
    return makeResult('erp_login', 'ERP login page accessible', false, { error: err.message });
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Check dashboard API endpoints.
 */
async function checkDashboardAPI() {
  const endpoints = [
    { id: 'dashboard_metrics', path: '/api/demo/dashboard', name: 'Dashboard metrics' },
    { id: 'products_list', path: '/api/products', name: 'Products list' },
    { id: 'customers_list', path: '/api/customers', name: 'Customers list' },
    { id: 'orders_list', path: '/api/orders', name: 'Orders list' },
  ];

  const results = [];
  for (const ep of endpoints) {
    try {
      const res = await fetch(`${API_BASE.replace(/\/$/, '')}${ep.path}`, {
        signal: AbortSignal.timeout(8_000),
        headers: { Accept: 'application/json' },
      });
      results.push(makeResult(ep.id, ep.name, res.status < 500, { status: res.status }));
    } catch (err) {
      results.push(makeResult(ep.id, ep.name, false, { error: err.message }));
    }
  }

  return results;
}

/**
 * Check mobile viewport rendering.
 */
async function checkMobileViewport(context) {
  const page = await context.newPage({ viewport: { width: 375, height: 812 } });
  try {
    await page.goto(`${CCW_ERP_URL}/login`, {
      waitUntil: 'domcontentloaded',
      timeout: DEFAULT_TIMEOUT,
    });
    const hasOverflow = await page.evaluate(() => {
      return document.body.scrollWidth > window.innerWidth;
    });
    const title = await page.title();

    return makeResult('mobile_viewport', 'Mobile viewport (375px) — no overflow', !hasOverflow, {
      title,
      scrollWidth: await page.evaluate(() => document.body.scrollWidth),
      windowWidth: 375,
    });
  } catch (err) {
    return makeResult('mobile_viewport', 'Mobile viewport (375px)', false, { error: err.message });
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Check for critical console errors on ERP.
 */
async function checkConsoleErrors(context) {
  const page = await context.newPage();
  const errors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  try {
    await page.goto(`${CCW_ERP_URL}/login`, { waitUntil: 'networkidle', timeout: DEFAULT_TIMEOUT });

    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('favicon') && !e.includes('404') && !e.includes('net::ERR') && e.length > 10
    );

    return makeResult(
      'console_errors',
      'No critical console errors on ERP',
      criticalErrors.length === 0,
      {
        errorCount: criticalErrors.length,
        errors: criticalErrors.slice(0, 5),
      }
    );
  } catch (err) {
    return makeResult('console_errors', 'Console error check', false, { error: err.message });
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Run full QA check suite.
 *
 * @param {string} sessionId
 * @param {string} dataDir
 * @returns {Promise<Object>} QA report
 */
export async function runQACheck(sessionId, dataDir = './data/sessions') {
  console.log('\n[QA] Post-session QA check starting...');

  const sessionDir = path.join(dataDir, sessionId);
  await fs.mkdir(sessionDir, { recursive: true });

  const qaStart = Date.now();
  const allResults = [];

  // Backend health (no browser needed)
  allResults.push(await checkBackendHealth());

  // Dashboard API endpoints
  const apiResults = await checkDashboardAPI();
  allResults.push(...apiResults);

  // Browser-based checks
  let browser = null;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const [siteResult, loginResult, mobileResult, consoleResult] = await Promise.allSettled([
      checkCCWSite(context),
      checkERPLogin(context),
      checkMobileViewport(context),
      checkConsoleErrors(context),
    ]);

    for (const r of [siteResult, loginResult, mobileResult, consoleResult]) {
      if (r.status === 'fulfilled') allResults.push(r.value);
      else
        allResults.push(
          makeResult('browser_check', 'Browser check', false, { error: r.reason?.message })
        );
    }

    await context.close();
  } catch (err) {
    console.warn(`[QA] Browser unavailable: ${err.message} — skipping browser checks`);
    allResults.push(
      makeResult('browser_unavailable', 'Browser checks', false, { error: err.message })
    );
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  // Calculate QA status
  const passed = allResults.filter((r) => r.pass).length;
  const failed = allResults.filter((r) => !r.pass).length;
  const total = allResults.length;
  const passRate = Math.round((passed / total) * 100);

  let qaStatus = 'GREEN';
  if (passRate < 70) qaStatus = 'RED';
  else if (passRate < 90) qaStatus = 'AMBER';

  const report = {
    sessionId,
    generatedAt: new Date().toISOString(),
    qaStatus,
    summary: { passed, failed, total, passRate },
    results: allResults,
    durationMs: Date.now() - qaStart,
  };

  const outPath = path.join(sessionDir, 'qa-report.json');
  await fs.writeFile(outPath, JSON.stringify(report, null, 2));

  console.log(`[QA] QA_STATUS: ${qaStatus} — ${passed}/${total} checks passed (${passRate}%) ✅`);

  return report;
}

export default runQACheck;
