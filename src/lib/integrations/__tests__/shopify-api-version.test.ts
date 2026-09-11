/**
 * UNI-2672: the Admin API version is a pin, and how it was chosen is reportable.
 *
 * The defect this guards against is silence. Before this change an unset
 * `SHOPIFY_API_VERSION` produced `2025-01` with no signal anywhere — the only
 * warning fired for a malformed override — so a nearly two-year-old version
 * could be live and look exactly like a deliberate choice.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getShopifyApiVersion,
  getPinnedShopifyApiVersion,
  describeShopifyApiVersion,
  adminApiUrl,
} from '../shopify';

let saved: string | undefined;

beforeEach(() => {
  saved = process.env.SHOPIFY_API_VERSION;
  delete process.env.SHOPIFY_API_VERSION;
});

afterEach(() => {
  if (saved === undefined) delete process.env.SHOPIFY_API_VERSION;
  else process.env.SHOPIFY_API_VERSION = saved;
});

describe('the pin', () => {
  it('is a YYYY-MM version compiled into the build', () => {
    expect(getPinnedShopifyApiVersion()).toMatch(/^\d{4}-\d{2}$/);
  });

  it('is what an unset environment resolves to', () => {
    expect(getShopifyApiVersion()).toBe(getPinnedShopifyApiVersion());
  });

  it('is reported as coming from the pin, not from an override', () => {
    expect(describeShopifyApiVersion().source).toBe('pin');
  });
});

describe('the override', () => {
  it('wins when it is well-formed', () => {
    process.env.SHOPIFY_API_VERSION = '2026-07';
    expect(getShopifyApiVersion()).toBe('2026-07');
    expect(describeShopifyApiVersion()).toMatchObject({
      effective: '2026-07',
      source: 'override',
    });
  });

  it.each(['ccw-optix', '2026-7', '26-07', '2026/07', ''])(
    'falls back to the pin and says so for %o',
    (value) => {
      process.env.SHOPIFY_API_VERSION = value;
      expect(getShopifyApiVersion()).toBe(getPinnedShopifyApiVersion());
      // An empty string is absence, not a malformed override.
      expect(describeShopifyApiVersion().source).toBe(
        value === '' ? 'pin' : 'pin-after-invalid-override'
      );
    }
  );
});

describe('the resolved version reaches the URL', () => {
  it('is embedded in the Admin API path', () => {
    process.env.SHOPIFY_API_VERSION = '2026-07';
    expect(adminApiUrl('ccw.myshopify.com', '/shop.json')).toBe(
      'https://ccw.myshopify.com/admin/api/2026-07/shop.json'
    );
  });

  it('uses the pin when nothing is set', () => {
    expect(adminApiUrl('ccw.myshopify.com', '/shop.json')).toContain(
      `/admin/api/${getPinnedShopifyApiVersion()}/`
    );
  });
});
