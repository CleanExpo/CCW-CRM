/**
 * UNI-2751: capture runs against an in-memory prisma fake and a fake fetcher.
 * No real site is ever contacted.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type CP = {
  id: string;
  ownerUserId: string;
  competitor: string;
  url: string;
  title: string | null;
  productId: string | null;
  matchStatus: string;
  isActive: boolean;
  lastAttemptAt: Date | null;
  lastError: string | null;
};
type Price = {
  competitorProductId: string;
  price: number;
  currency: string;
  source: string;
  capturedAt: Date;
};

const db = vi.hoisted(() => ({
  cps: [] as CP[],
  prices: [] as Price[],
  runs: [] as Record<string, unknown>[],
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    competitorCaptureRun: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const r = { id: `run-${db.runs.length}`, ...data };
        db.runs.push(r);
        return r;
      }),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const r = db.runs.find((x) => x.id === where.id)!;
          Object.assign(r, data);
          return r;
        }
      ),
    },
    competitorProduct: {
      findMany: vi.fn(
        async ({ where }: { where: { ownerUserId: { in: string[] }; id?: string } }) =>
          db.cps.filter(
            (c) =>
              where.ownerUserId.in.includes(c.ownerUserId) &&
              c.isActive &&
              c.matchStatus !== 'rejected' &&
              (!where.id || c.id === where.id)
          )
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<CP> }) => {
        const c = db.cps.find((x) => x.id === where.id)!;
        Object.assign(c, data);
        return c;
      }),
    },
    competitorPrice: {
      create: vi.fn(async ({ data }: { data: Price }) => {
        db.prices.push(data);
        return data;
      }),
    },
  },
}));

import { clampPageBudget, runCapture, type Fetcher } from '@/lib/price-mole/price-mole-service';

const PAGE = (price: string) =>
  `<script type="application/ld+json">{"@type":"Product","name":"Galaxy","offers":{"price":"${price}","priceCurrency":"AUD"}}</script>`;
const NOW = new Date('2026-09-21T01:00:00Z');

function cp(id: string, url: string, over: Partial<CP> = {}): CP {
  return {
    id,
    ownerUserId: 'user-a',
    competitor: 'Rival',
    url,
    title: null,
    productId: 'p1',
    matchStatus: 'confirmed',
    isActive: true,
    lastAttemptAt: null,
    lastError: null,
    ...over,
  };
}

function fetcherFrom(pages: Record<string, { status: number; text: string }>) {
  const calls: string[] = [];
  const f: Fetcher = async (url) => {
    calls.push(url);
    const hit = pages[url];
    if (!hit) return { status: 404, text: '' };
    return hit;
  };
  return { f, calls };
}

beforeEach(() => {
  db.cps = [];
  db.prices = [];
  db.runs = [];
});

describe('runCapture — positive control', () => {
  it('a known page yields its known price; a redesigned page records an error and writes no price', async () => {
    db.cps = [
      cp('good', 'https://rival.example/p/galaxy'),
      cp('changed', 'https://rival.example/p/wand'),
    ];
    const { f } = fetcherFrom({
      'https://rival.example/robots.txt': { status: 200, text: 'User-agent: *\nDisallow: /cart' },
      'https://rival.example/p/galaxy': { status: 200, text: PAGE('12345.50') },
      'https://rival.example/p/wand': { status: 200, text: '<div class="price">$89</div>' },
    });
    const res = await runCapture(['user-a'], 'staff', { trigger: 'manual', fetcher: f, now: NOW });

    expect(db.prices).toEqual([
      {
        competitorProductId: 'good',
        price: 12345.5,
        currency: 'AUD',
        source: 'capture',
        capturedAt: NOW,
      },
    ]);
    const changed = db.cps.find((c) => c.id === 'changed')!;
    expect(changed.lastError).toMatch(/layout may have changed/);
    expect(res.run).toMatchObject({ attempted: 2, succeeded: 1, failed: 1 });
  });

  it('an HTTP error is a failure, never a price', async () => {
    db.cps = [cp('gone', 'https://rival.example/p/gone')];
    const { f } = fetcherFrom({
      'https://rival.example/robots.txt': { status: 404, text: '' },
      'https://rival.example/p/gone': { status: 410, text: PAGE('1') },
    });
    const res = await runCapture(['user-a'], 'staff', { trigger: 'manual', fetcher: f, now: NOW });
    expect(db.prices).toHaveLength(0);
    expect(res.outcomes[0]).toMatchObject({ ok: false, error: 'Page returned HTTP 410' });
  });
});

describe('runCapture — guard', () => {
  it('never fetches a redirect target robots.txt disallows, and records why', async () => {
    db.cps = [cp('moved', 'https://rival.example/product')];
    const calls: string[] = [];
    // Behaves like createSafeFetch: asks before following the redirect to /secret.
    const f: Fetcher = async (url, opts) => {
      calls.push(url);
      if (url === 'https://rival.example/robots.txt') {
        return { status: 200, text: 'User-agent: *\nDisallow: /secret' };
      }
      if (url === 'https://rival.example/product') {
        await opts?.allowRedirect?.(new URL('https://rival.example/secret'));
        calls.push('https://rival.example/secret');
        return { status: 200, text: PAGE('999') };
      }
      return { status: 404, text: '' };
    };
    const res = await runCapture(['user-a'], 'staff', { trigger: 'manual', fetcher: f, now: NOW });
    expect(db.prices).toHaveLength(0);
    expect(calls).not.toContain('https://rival.example/secret');
    expect(res.outcomes[0]).toMatchObject({ ok: false, error: expect.stringMatching(/redirect/) });
  });

  it('positive control: a redirect to an allowed page on another site is checked and followed', async () => {
    db.cps = [cp('moved', 'https://rival.example/product')];
    const calls: string[] = [];
    const f: Fetcher = async (url, opts) => {
      calls.push(url);
      if (url.endsWith('/robots.txt'))
        return { status: 200, text: 'User-agent: *\nDisallow: /cart' };
      if (url === 'https://rival.example/product') {
        await opts?.allowRedirect?.(new URL('https://shop.rival.example/p/galaxy'));
        return { status: 200, text: PAGE('42') };
      }
      return { status: 404, text: '' };
    };
    await runCapture(['user-a'], 'staff', { trigger: 'manual', fetcher: f, now: NOW });
    expect(calls).toContain('https://shop.rival.example/robots.txt');
    expect(db.prices.map((p) => p.price)).toEqual([42]);
  });

  it('does not fetch a page robots.txt disallows', async () => {
    db.cps = [cp('blocked', 'https://strict.example/shop/item')];
    const { f, calls } = fetcherFrom({
      'https://strict.example/robots.txt': { status: 200, text: 'User-agent: *\nDisallow: /shop' },
      'https://strict.example/shop/item': { status: 200, text: PAGE('10') },
    });
    const res = await runCapture(['user-a'], 'staff', { trigger: 'manual', fetcher: f, now: NOW });
    expect(calls).toEqual(['https://strict.example/robots.txt']);
    expect(db.prices).toHaveLength(0);
    expect(res.run).toMatchObject({ attempted: 0, skipped: 1 });
  });

  it('does not fetch when robots.txt cannot be read (5xx)', async () => {
    db.cps = [cp('unknown', 'https://flaky.example/p')];
    const { f, calls } = fetcherFrom({
      'https://flaky.example/robots.txt': { status: 503, text: '' },
    });
    await runCapture(['user-a'], 'staff', { trigger: 'manual', fetcher: f, now: NOW });
    expect(calls).toEqual(['https://flaky.example/robots.txt']);
  });

  it('stops hard at the page budget and records why', async () => {
    db.cps = [1, 2, 3, 4, 5].map((i) => cp(`c${i}`, `https://rival.example/p/${i}`));
    const pages: Record<string, { status: number; text: string }> = {
      'https://rival.example/robots.txt': { status: 200, text: '' },
    };
    for (let i = 1; i <= 5; i++)
      pages[`https://rival.example/p/${i}`] = { status: 200, text: PAGE(String(i * 10)) };
    const { f, calls } = fetcherFrom(pages);
    const res = await runCapture(['user-a'], 'staff', {
      trigger: 'manual',
      fetcher: f,
      now: NOW,
      pageBudget: 2,
    });
    expect(calls.filter((u) => u.includes('/p/'))).toHaveLength(2);
    expect(res.run).toMatchObject({ attempted: 2, stoppedReason: 'page budget of 2 reached' });
  });

  it('caps robots.txt fetches by the budget when every page is on a different host', async () => {
    // Every robots.txt fails (503), so no page is fetched and only the robots cap can stop the run.
    db.cps = [1, 2, 3, 4, 5, 6].map((i) => cp(`h${i}`, `https://h${i}.example/p`));
    const pages: Record<string, { status: number; text: string }> = {};
    for (let i = 1; i <= 6; i++)
      pages[`https://h${i}.example/robots.txt`] = { status: 503, text: '' };
    const { f, calls } = fetcherFrom(pages);
    const res = await runCapture(['user-a'], 'staff', {
      trigger: 'manual',
      fetcher: f,
      now: NOW,
      pageBudget: 2,
    });
    expect(calls.filter((u) => u.endsWith('/robots.txt'))).toHaveLength(2);
    expect(res.run).toMatchObject({ stoppedReason: 'robots.txt budget of 2 reached' });
  });

  it('clamps an oversized budget to the ceiling', async () => {
    const res = await runCapture(['user-a'], 'staff', {
      trigger: 'manual',
      fetcher: fetcherFrom({}).f,
      now: NOW,
      pageBudget: 1_000_000,
    });
    expect(res.run.pageBudget).toBe(200);
  });

  it('a non-number budget cannot switch the hard stop off', async () => {
    for (const bad of [NaN, Infinity, -Infinity, 'lots', null]) {
      const b = clampPageBudget(bad);
      expect(Number.isFinite(b), String(bad)).toBe(true);
      expect(b).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(200);
    }
    db.cps = [1, 2, 3, 4, 5, 6].map((i) => cp(`n${i}`, `https://rival.example/n/${i}`));
    const pages: Record<string, { status: number; text: string }> = {
      'https://rival.example/robots.txt': { status: 200, text: '' },
    };
    for (let i = 1; i <= 6; i++)
      pages[`https://rival.example/n/${i}`] = { status: 200, text: PAGE(String(i)) };
    const { f } = fetcherFrom(pages);
    const res = await runCapture(['user-a'], 'staff', {
      trigger: 'manual',
      fetcher: f,
      now: NOW,
      pageBudget: NaN,
    });
    expect(Number.isFinite(res.run.pageBudget)).toBe(true);
  });

  it('skips a page checked in the last 20 hours without fetching it', async () => {
    db.cps = [
      cp('recent', 'https://rival.example/p/r', {
        lastAttemptAt: new Date(NOW.getTime() - 3_600_000),
      }),
    ];
    const { f, calls } = fetcherFrom({});
    const res = await runCapture(['user-a'], 'staff', { trigger: 'manual', fetcher: f, now: NOW });
    expect(calls).toHaveLength(0);
    expect(res.run).toMatchObject({ skipped: 1, attempted: 0 });
  });

  it('never touches rows from another workspace', async () => {
    db.cps = [cp('theirs', 'https://rival.example/p/t', { ownerUserId: 'user-other' })];
    const { f, calls } = fetcherFrom({});
    await runCapture(['user-a'], 'staff', { trigger: 'manual', fetcher: f, now: NOW });
    expect(calls).toHaveLength(0);
  });
});
