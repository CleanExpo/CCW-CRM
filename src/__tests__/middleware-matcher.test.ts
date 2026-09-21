/**
 * UNI-2693: the middleware matcher skips image files so static assets load
 * without a session. That skip must not reach /api: a route named like
 * /api/export.png is a live handler and still needs the auth gate.
 */
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { describe, expect, it } from 'vitest';

import { config } from '@/middleware';

const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url });

describe('middleware matcher', () => {
  it.each(['/api/x.png', '/api/reports/chart.svg', '/api/a/b.jpeg', '/api/logo.webp'])(
    'runs auth middleware on image-named API path %s',
    (url) => {
      expect(matches(url)).toBe(true);
    }
  );

  it.each(['/logo.png', '/images/hero.webp', '/icons/a.svg', '/brand/mark.jpg'])(
    'still skips static image %s',
    (url) => {
      expect(matches(url)).toBe(false);
    }
  );

  it.each(['/_next/static/chunk.js', '/_next/image', '/favicon.ico'])(
    'still skips framework asset %s',
    (url) => {
      expect(matches(url)).toBe(false);
    }
  );

  it.each(['/api/settings/company', '/dashboard', '/dashboard/finance', '/'])(
    'still runs on ordinary path %s',
    (url) => {
      expect(matches(url)).toBe(true);
    }
  );
});
