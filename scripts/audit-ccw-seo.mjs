#!/usr/bin/env node

const DEFAULT_SITE = 'https://ccwonline.com.au';
const DEFAULT_SAMPLE_SIZE = 24;
const REQUEST_TIMEOUT_MS = 15000;

const args = parseArgs(process.argv.slice(2));
const site = normaliseSite(args.site || DEFAULT_SITE);
const sampleSize = Number.parseInt(args['sample-size'] || `${DEFAULT_SAMPLE_SIZE}`, 10);
const outputJson = Boolean(args.json);

const userAgent = 'CCW-CRM SEO Repair Audit/1.0 (+https://github.com/CleanExpo/CCW-CRM)';

main().catch((error) => {
  console.error(`Audit failed: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  const startedAt = new Date().toISOString();
  const discovery = await checkDiscovery(site);
  const sitemap = await crawlSitemapIndex(`${site}/sitemap.xml`);
  const sampledUrls = chooseSample(sitemap.urls, sampleSize);
  const pages = await mapLimit(sampledUrls, 4, (url) => auditPage(url));

  const result = {
    site,
    startedAt,
    finishedAt: new Date().toISOString(),
    discovery,
    sitemap: summariseSitemap(sitemap),
    pages,
    findings: summariseFindings(discovery, sitemap, pages),
  };

  if (outputJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printHumanSummary(result);
}

function parseArgs(rawArgs) {
  const parsed = {};

  for (const arg of rawArgs) {
    if (arg === '--json') {
      parsed.json = true;
      continue;
    }

    if (arg.startsWith('--') && arg.includes('=')) {
      const [key, ...valueParts] = arg.slice(2).split('=');
      parsed[key] = valueParts.join('=');
    }
  }

  return parsed;
}

function normaliseSite(value) {
  return value.replace(/\/+$/, '');
}

async function checkDiscovery(baseUrl) {
  const paths = ['/robots.txt', '/sitemap.xml', '/llms.txt', '/agents.md', '/.well-known/ucp'];
  const checks = {};

  for (const path of paths) {
    const url = `${baseUrl}${path}`;
    const response = await fetchText(url);
    checks[path] = {
      url,
      status: response.status,
      ok: response.ok,
      contentType: response.contentType,
      bytes: response.bytes,
    };
  }

  return checks;
}

async function crawlSitemapIndex(sitemapUrl) {
  const index = await fetchText(sitemapUrl);
  const childSitemaps = extractLocs(index.body);
  const sitemapEntries = [];
  const urls = [];

  for (const childUrl of childSitemaps) {
    const child = await fetchText(childUrl);
    const childUrls = extractLocs(child.body);
    sitemapEntries.push({
      url: childUrl,
      status: child.status,
      ok: child.ok,
      entries: childUrls.length,
    });
    urls.push(...childUrls.map((url) => ({ url, sitemap: childUrl })));
  }

  return {
    index: {
      url: sitemapUrl,
      status: index.status,
      ok: index.ok,
      childSitemaps: childSitemaps.length,
    },
    sitemaps: sitemapEntries,
    urls,
  };
}

function extractLocs(xml) {
  const locs = [];
  const locPattern = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let match;

  while ((match = locPattern.exec(xml)) !== null) {
    locs.push(decodeXml(match[1].trim()));
  }

  return locs;
}

function decodeXml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function summariseSitemap(sitemap) {
  const uniqueUrls = new Set(sitemap.urls.map((entry) => entry.url));
  const duplicateUrls = sitemap.urls.length - uniqueUrls.size;
  const byType = {};

  for (const entry of uniqueUrls) {
    const type = classifyUrl(entry);
    byType[type] = (byType[type] || 0) + 1;
  }

  return {
    index: sitemap.index,
    sitemaps: sitemap.sitemaps,
    totalEntries: sitemap.urls.length,
    uniqueEntries: uniqueUrls.size,
    duplicateEntries: duplicateUrls,
    byType,
  };
}

function chooseSample(urlEntries, limit) {
  const seen = new Set();
  const buckets = new Map();

  for (const entry of urlEntries) {
    if (seen.has(entry.url)) {
      continue;
    }
    seen.add(entry.url);

    const type = classifyUrl(entry.url);
    if (!buckets.has(type)) {
      buckets.set(type, []);
    }
    buckets.get(type).push(entry.url);
  }

  const typeOrder = ['home', 'page', 'collection', 'product', 'blog', 'other'];
  const sample = [];

  for (const type of typeOrder) {
    const urls = buckets.get(type) || [];
    const typeLimit = Math.max(1, Math.floor(limit / typeOrder.length));
    sample.push(...urls.slice(0, typeLimit));
  }

  for (const urls of buckets.values()) {
    for (const url of urls) {
      if (sample.length >= limit) {
        return sample;
      }
      if (!sample.includes(url)) {
        sample.push(url);
      }
    }
  }

  return sample.slice(0, limit);
}

function classifyUrl(url) {
  const { pathname } = new URL(url);

  if (pathname === '/') {
    return 'home';
  }
  if (pathname.startsWith('/products/')) {
    return 'product';
  }
  if (pathname.startsWith('/collections/')) {
    return 'collection';
  }
  if (pathname.startsWith('/blogs/')) {
    return 'blog';
  }
  if (pathname.startsWith('/pages/')) {
    return 'page';
  }

  return 'other';
}

async function auditPage(url) {
  const response = await fetchText(url);
  const html = response.body || '';
  const isHtml = /text\/html|application\/xhtml\+xml/i.test(response.contentType);

  if (!isHtml) {
    return {
      url,
      type: classifyUrl(url),
      status: response.status,
      ok: response.ok,
      contentType: response.contentType,
      bytes: response.bytes,
      title: '',
      titleLength: 0,
      metaDescription: '',
      metaDescriptionLength: 0,
      canonical: '',
      imageCount: 0,
      missingAltCount: 0,
      jsonLdBlockCount: 0,
      jsonLdParseErrors: 0,
      warnings: [],
    };
  }

  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescription = firstMatch(
    html,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i
  );
  const canonical = firstMatch(
    html,
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["'][^>]*>/i
  );
  const images = Array.from(html.matchAll(/<img\b[^>]*>/gi)).map((match) => match[0]);
  const missingAlt = images.filter((tag) => !/\salt\s*=\s*["'][^"']*["']/i.test(tag));
  const assets = Array.from(
    html.matchAll(/<(script|link|img)[^>]+(?:src|href)=["']([^"']+)["']/gi)
  ).map((match) => match[2]);
  const jsonLdBlocks = Array.from(
    html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  ).map((match) => match[1].trim());

  return {
    url,
    type: classifyUrl(url),
    status: response.status,
    ok: response.ok,
    contentType: response.contentType,
    bytes: response.bytes,
    title: cleanText(title),
    titleLength: cleanText(title).length,
    metaDescription: cleanText(metaDescription),
    metaDescriptionLength: cleanText(metaDescription).length,
    canonical,
    scriptTagCount: countMatches(html, /<script\b/gi),
    linkTagCount: countMatches(html, /<link\b/gi),
    imageCount: images.length,
    missingAltCount: missingAlt.length,
    assetHostCounts: countAssetHosts(assets, url),
    jsonLdBlockCount: jsonLdBlocks.length,
    jsonLdParseErrors: jsonLdBlocks.filter((block) => !isJson(block)).length,
    warnings: pageWarnings({
      bytes: response.bytes,
      title: cleanText(title),
      metaDescription: cleanText(metaDescription),
      missingAltCount: missingAlt.length,
      jsonLdBlocks,
    }),
  };
}

function pageWarnings({ bytes, title, metaDescription, missingAltCount, jsonLdBlocks }) {
  const warnings = [];

  if (bytes >= 1_000_000) {
    warnings.push('html_over_1mb');
  }
  if (!title) {
    warnings.push('missing_title');
  } else if (title.length > 60) {
    warnings.push('long_title');
  }
  if (!metaDescription) {
    warnings.push('missing_meta_description');
  } else if (metaDescription.length > 160) {
    warnings.push('long_meta_description');
  }
  if (missingAltCount > 0) {
    warnings.push('missing_image_alt');
  }
  if (jsonLdBlocks.length === 0) {
    warnings.push('no_json_ld_detected');
  }

  return warnings;
}

function firstMatch(value, pattern) {
  const match = value.match(pattern);
  return match ? match[1] : '';
}

function countMatches(value, pattern) {
  return (value.match(pattern) || []).length;
}

function countAssetHosts(assets, pageUrl) {
  const counts = {};

  for (const asset of assets) {
    let host = 'relative';
    try {
      host = new URL(asset, pageUrl).host;
    } catch {
      // Keep the relative fallback.
    }
    counts[host] = (counts[host] || 0) + 1;
  }

  return Object.fromEntries(
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
  );
}

function cleanText(value) {
  return decodeHtml(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

function isJson(value) {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

function summariseFindings(discovery, sitemap, pages) {
  const pageWarningCounts = {};

  for (const page of pages) {
    for (const warning of page.warnings) {
      pageWarningCounts[warning] = (pageWarningCounts[warning] || 0) + 1;
    }
  }

  return {
    discoveryFailures: Object.entries(discovery)
      .filter(([, check]) => !check.ok)
      .map(([path]) => path),
    duplicateSitemapEntries:
      sitemap.urls.length - new Set(sitemap.urls.map((entry) => entry.url)).size,
    sampledPages: pages.length,
    pageWarningCounts,
  };
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml,text/plain,*/*',
        'user-agent': userAgent,
      },
    });
    const body = await response.text();

    return {
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get('content-type') || '',
      bytes: Buffer.byteLength(body),
      body,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function mapLimit(values, limit, worker) {
  const results = [];
  let index = 0;

  async function run() {
    while (index < values.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await worker(values[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, run));
  return results;
}

function printHumanSummary(result) {
  console.log(`# CCW SEO Repair Audit`);
  console.log(`Site: ${result.site}`);
  console.log(`Started: ${result.startedAt}`);
  console.log(`Finished: ${result.finishedAt}`);
  console.log('');

  console.log('Discovery surfaces');
  for (const [path, check] of Object.entries(result.discovery)) {
    console.log(`- ${path}: ${check.status} (${check.bytes} bytes)`);
  }
  console.log('');

  console.log('Sitemap');
  console.log(`- Child sitemaps: ${result.sitemap.index.childSitemaps}`);
  console.log(`- Total entries: ${result.sitemap.totalEntries}`);
  console.log(`- Unique entries: ${result.sitemap.uniqueEntries}`);
  console.log(`- Duplicate entries: ${result.sitemap.duplicateEntries}`);
  console.log(`- By type: ${JSON.stringify(result.sitemap.byType)}`);
  console.log('');

  console.log('Sampled page warnings');
  for (const [warning, count] of Object.entries(result.findings.pageWarningCounts)) {
    console.log(`- ${warning}: ${count}`);
  }
  console.log('');

  console.log('Sampled pages');
  for (const page of result.pages) {
    console.log(
      `- ${page.status} ${page.type} ${page.url} | ${page.bytes} bytes | title ${page.titleLength} | meta ${page.metaDescriptionLength} | scripts ${page.scriptTagCount || 0} | missing alt ${page.missingAltCount} | JSON-LD ${page.jsonLdBlockCount}/${page.jsonLdParseErrors} parse errors`
    );
    if (page.assetHostCounts && Object.keys(page.assetHostCounts).length > 0) {
      console.log(`  asset hosts: ${JSON.stringify(page.assetHostCounts)}`);
    }
  }
}
