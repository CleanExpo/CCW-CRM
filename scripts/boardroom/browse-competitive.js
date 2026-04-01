/**
 * CCW Boardroom — Competitive Intelligence Browser (UNI-1691)
 *
 * Wires gstack /browse capability into the CRON pre-session pipeline.
 * Scrapes competitor sites and pricing pages using Playwright Chromium.
 * Runs BEFORE board deliberation to inject fresh market context.
 *
 * Targets:
 *   1. Competitor pricing pages (carpet cleaning equipment AU)
 *   2. Industry news (Google News: carpet cleaning industry AU)
 *   3. CCW's own live site health + pricing consistency check
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

const TIMEOUT_MS = 15_000;

const COMPETITIVE_TARGETS = [
  {
    id: 'ccw_live',
    name: 'CCW Live Site',
    url: 'https://www.carpetcleanerswarehouse.com.au',
    type: 'own',
    extractors: ['title', 'metaDescription', 'h1s', 'pricePoints'],
  },
  {
    id: 'ccw_products',
    name: 'CCW Products Page',
    url: 'https://www.carpetcleanerswarehouse.com.au/collections/all',
    type: 'own',
    extractors: ['productCount', 'priceRange', 'h1s'],
  },
  {
    id: 'au_competitor_search',
    name: 'AU Equipment Competitors',
    url: 'https://www.google.com.au/search?q=carpet+cleaning+equipment+australia+buy+online&num=5',
    type: 'competitor',
    extractors: ['organicResults'],
  },
  {
    id: 'industry_news',
    name: 'Industry News',
    url: 'https://www.google.com.au/search?q=carpet+cleaning+industry+australia+2026&tbm=nws&num=5',
    type: 'news',
    extractors: ['newsHeadlines'],
  },
];

/**
 * Extract key data from a page based on requested extractors.
 */
async function extractPageData(page, extractors) {
  const result = {};

  for (const extractor of extractors) {
    try {
      switch (extractor) {
        case 'title':
          result.title = await page.title();
          break;

        case 'metaDescription':
          result.metaDescription = await page
            .$eval('meta[name="description"]', (el) => el.getAttribute('content'))
            .catch(() => null);
          break;

        case 'h1s':
          result.h1s = await page.$$eval('h1', (els) => els.map((e) => e.textContent?.trim()).filter(Boolean).slice(0, 3));
          break;

        case 'pricePoints':
          result.pricePoints = await page
            .$$eval('[class*="price"], .price, [data-price]', (els) =>
              els
                .map((e) => e.textContent?.trim())
                .filter((t) => t && /\$[\d,]+/.test(t))
                .slice(0, 10)
            )
            .catch(() => []);
          break;

        case 'priceRange':
          const prices = await page
            .$$eval('[class*="price"], .price', (els) =>
              els
                .map((e) => {
                  const match = e.textContent?.match(/\$([\d,]+)/);
                  return match ? parseFloat(match[1].replace(',', '')) : null;
                })
                .filter(Boolean)
            )
            .catch(() => []);
          if (prices.length > 0) {
            result.priceRange = { min: Math.min(...prices), max: Math.max(...prices), count: prices.length };
          }
          break;

        case 'productCount':
          result.productCount = await page
            .$$eval('[class*="product"], .product-card, article', (els) => els.length)
            .catch(() => 0);
          break;

        case 'organicResults':
          result.organicResults = await page
            .$$eval('h3', (els) =>
              els
                .map((e) => {
                  const anchor = e.closest('a');
                  return { text: e.textContent?.trim(), href: anchor?.href || null };
                })
                .filter((r) => r.text)
                .slice(0, 5)
            )
            .catch(() => []);
          break;

        case 'newsHeadlines':
          result.newsHeadlines = await page
            .$$eval('h3, [role="heading"]', (els) =>
              els
                .map((e) => e.textContent?.trim())
                .filter((t) => t && t.length > 20)
                .slice(0, 8)
            )
            .catch(() => []);
          break;
      }
    } catch (err) {
      result[extractor] = null;
    }
  }

  return result;
}

/**
 * Run competitive intelligence scrape.
 *
 * @param {string} sessionId - Current boardroom session ID
 * @param {string} dataDir - Root data directory
 * @returns {Promise<Object>} Competitive intelligence summary
 */
export async function runCompetitiveIntelligence(sessionId, dataDir = './data/sessions') {
  console.log('\n[Browse] Step 03b — Competitive Intelligence scraping...');

  const sessionDir = path.join(dataDir, sessionId);
  await fs.mkdir(sessionDir, { recursive: true });

  const results = [];
  let browser = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'en-AU',
    });

    for (const target of COMPETITIVE_TARGETS) {
      console.log(`[Browse] Scraping ${target.name}...`);
      const page = await context.newPage();

      try {
        await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
        await page.waitForTimeout(1500);

        const data = await extractPageData(page, target.extractors);

        results.push({
          id: target.id,
          name: target.name,
          url: target.url,
          type: target.type,
          scrapedAt: new Date().toISOString(),
          data,
          success: true,
        });

        console.log(`[Browse] ${target.name} ✅`);
      } catch (err) {
        results.push({
          id: target.id,
          name: target.name,
          url: target.url,
          type: target.type,
          scrapedAt: new Date().toISOString(),
          error: err.message,
          success: false,
        });
        console.warn(`[Browse] ${target.name} failed: ${err.message}`);
      } finally {
        await page.close();
      }
    }

    await context.close();
  } catch (err) {
    console.warn(`[Browse] Browser launch failed: ${err.message} — skipping competitive intelligence`);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  // Synthesise summary
  const ownSite = results.find((r) => r.id === 'ccw_live');
  const competitors = results.filter((r) => r.type === 'competitor');
  const news = results.find((r) => r.type === 'news');

  const summary = {
    sessionId,
    generatedAt: new Date().toISOString(),
    ccwSiteStatus: ownSite?.success ? 'ONLINE' : 'UNREACHABLE',
    ccwTitle: ownSite?.data?.title || null,
    priceRange: results.find((r) => r.id === 'ccw_products')?.data?.priceRange || null,
    competitorResults: competitors.flatMap((r) => r.data?.organicResults || []).slice(0, 5),
    industryNews: news?.data?.newsHeadlines || [],
    rawResults: results,
  };

  const outPath = path.join(sessionDir, 'competitive-intelligence.json');
  await fs.writeFile(outPath, JSON.stringify(summary, null, 2));
  console.log(`[Browse] Competitive intelligence saved → ${outPath} ✅`);

  return summary;
}

export default runCompetitiveIntelligence;
