import { describe, expect, it } from 'vitest';
import {
  extractPrice,
  marginAtMatch,
  presentPrice,
  PriceNotFoundError,
  robotsAllows,
} from '@/lib/price-mole/rules';

const KNOWN_PAGE = `<!doctype html><html><head>
<title>Prochem Galaxy 1200 | Competitor Co</title>
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[
  {"@type":"BreadcrumbList","itemListElement":[]},
  {"@type":"Product","name":"Prochem Galaxy 1200","sku":"GAL-1200",
   "offers":{"@type":"Offer","price":"12,345.50","priceCurrency":"AUD","availability":"InStock"}}
]}
</script></head><body><span class="price">$9,999.00</span></body></html>`;

const REDESIGNED_PAGE = `<!doctype html><html><head><title>Prochem Galaxy 1200</title></head>
<body><div class="hero"><span data-amount="12345.50">$12,345.50</span></div></body></html>`;

describe('extractPrice — positive control', () => {
  it('a known competitor page returns its known price from structured data, not visible text', () => {
    expect(extractPrice(KNOWN_PAGE)).toEqual({
      price: 12345.5,
      currency: 'AUD',
      title: 'Prochem Galaxy 1200',
      via: 'json-ld',
    });
  });

  it('a changed layout fails loudly instead of guessing a number from the page', () => {
    expect(() => extractPrice(REDESIGNED_PAGE)).toThrow(PriceNotFoundError);
  });

  it('malformed JSON-LD and a Product with no offer price also fail loudly', () => {
    expect(() => extractPrice('<script type="application/ld+json">{bad json</script>')).toThrow(
      PriceNotFoundError
    );
    expect(() =>
      extractPrice(
        '<script type="application/ld+json">{"@type":"Product","name":"X","offers":{"price":""}}</script>'
      )
    ).toThrow(PriceNotFoundError);
  });
});

describe('extractPrice — other published formats', () => {
  it('reads AggregateOffer lowPrice and an array of offers', () => {
    const agg =
      '<script type="application/ld+json">{"@type":["Product"],"offers":{"@type":"AggregateOffer","lowPrice":199}}</script>';
    expect(extractPrice(agg).price).toBe(199);
    const arr =
      '<script type="application/ld+json">[{"@type":"Product","offers":[{"price":"0"},{"price":"49.95"}]}]</script>';
    expect(extractPrice(arr).price).toBe(49.95);
  });

  it('falls back to the product:price:amount meta tag', () => {
    const html =
      '<meta property="og:title" content="Wand &amp; Hose"><meta property="product:price:amount" content="89.00"><meta property="product:price:currency" content="AUD">';
    expect(extractPrice(html)).toEqual({
      price: 89,
      currency: 'AUD',
      title: 'Wand & Hose',
      via: 'meta',
    });
  });
});

describe('robotsAllows — guard', () => {
  it('an empty or partial User-agent line never overrides the * group', () => {
    const empty = ['User-agent:', 'Allow: /', '', 'User-agent: *', 'Disallow: /'].join('\n');
    expect(robotsAllows(empty, '/anything')).toBe(false);
    const partial = ['User-agent: c', 'Allow: /', '', 'User-agent: *', 'Disallow: /'].join('\n');
    expect(robotsAllows(partial, '/anything')).toBe(false);
  });

  it('a group naming our agent, with or without a version, applies to us', () => {
    const versioned = ['User-agent: CCW-Optix-PriceMole/1.0', 'Disallow: /'].join('\n');
    expect(robotsAllows(versioned, '/anything')).toBe(false);
    // Positive control: our own group can also open a path that * closes.
    const opens = [
      'User-agent: ccw-optix-pricemole',
      'Allow: /',
      '',
      'User-agent: *',
      'Disallow: /',
    ].join('\n');
    expect(robotsAllows(opens, '/anything')).toBe(true);
  });

  const robots = `
User-agent: *
Disallow: /checkout
Disallow: /products/private
Allow: /products/private/ok

User-agent: BadBot
Disallow: /
`;
  it('refuses a disallowed path and allows the rest', () => {
    expect(robotsAllows(robots, '/checkout/step1')).toBe(false);
    expect(robotsAllows(robots, '/products/private/x')).toBe(false);
    expect(robotsAllows(robots, '/products/private/ok')).toBe(true);
    expect(robotsAllows(robots, '/products/galaxy-1200')).toBe(true);
  });

  it('a group naming our agent overrides the * group', () => {
    const mine = 'User-agent: *\nDisallow:\n\nUser-agent: CCW-Optix-PriceMole\nDisallow: /';
    expect(robotsAllows(mine, '/anything')).toBe(false);
  });

  it('an empty robots file allows everything', () => {
    expect(robotsAllows('', '/x')).toBe(true);
  });
});

describe('presentPrice — freshness', () => {
  const now = new Date('2026-09-21T00:00:00Z');
  it('always carries the capture date, and flags a price older than 7 days as stale', () => {
    const fresh = presentPrice(
      {
        price: 10,
        currency: 'AUD',
        capturedAt: new Date('2026-09-15T00:00:00Z'),
        source: 'capture',
      },
      now
    );
    expect(fresh).toMatchObject({
      captured_at: '2026-09-15T00:00:00.000Z',
      age_days: 6,
      stale: false,
    });
    const old = presentPrice(
      {
        price: 10,
        currency: 'AUD',
        capturedAt: new Date('2026-09-13T00:00:00Z'),
        source: 'capture',
      },
      now
    );
    expect(old).toMatchObject({
      captured_at: '2026-09-13T00:00:00.000Z',
      age_days: 8,
      stale: true,
    });
  });
});

describe('marginAtMatch', () => {
  it('computes the margin kept at the competitor price, or null with no cost on file', () => {
    expect(marginAtMatch(100, 60)).toBe(40);
    expect(marginAtMatch(100, null)).toBeNull();
  });
});
