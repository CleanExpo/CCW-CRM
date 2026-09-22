/** UNI-2747: every customer-facing ordering route is shut unless the gate is opened. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/portal/customer-context', () => ({
  resolvePortalCustomer: vi.fn(async () => ({
    userId: 'u',
    email: 'a@x.com',
    customerId: 'cust-a',
  })),
}));
vi.mock('@/lib/portal/my-price', async (orig) => {
  const real = await orig<typeof import('@/lib/portal/my-price')>();
  return {
    ...real,
    listMyPrices: vi.fn(async () => ({ items: [], total: 0 })),
    orderAgain: vi.fn(async () => ({
      order: { id: 'o', orderNumber: 'N', status: 'draft', total: 1 },
      unavailable: [],
    })),
    getQuoteCart: vi.fn(async () => ({ lines: [] })),
    orderQuote: vi.fn(async () => ({
      order: { id: 'o', orderNumber: 'N', status: 'draft', total: 1 },
      unavailable: [],
    })),
  };
});

import * as svc from '@/lib/portal/my-price';
import { resolvePortalCustomer } from '@/lib/portal/customer-context';
import { GET as myPrices } from '@/app/api/portal/my-prices/route';
import { POST as orderAgainRoute } from '@/app/api/portal/orders/[id]/order-again/route';
import { GET as quoteGet, POST as quotePost } from '@/app/api/portal/quote-cart/[quoteId]/route';

const req = (method = 'GET') =>
  new NextRequest('http://localhost/api/portal/x', {
    method,
    body: method === 'POST' ? '{}' : undefined,
  });
const params = <T>(v: T) => ({ params: Promise.resolve(v) });

const calls = () => [
  () => myPrices(req()),
  () => orderAgainRoute(req('POST'), params({ id: 'past-a' })),
  () => quoteGet(req(), params({ quoteId: 'q' })),
  () => quotePost(req('POST'), params({ quoteId: 'q' })),
];

const original = process.env.PORTAL_ORDERING_ENABLED;
afterEach(() => {
  if (original === undefined) delete process.env.PORTAL_ORDERING_ENABLED;
  else process.env.PORTAL_ORDERING_ENABLED = original;
});

describe('portal ordering gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PORTAL_ORDERING_ENABLED;
  });

  it('with the gate unset, every route returns 409 blocked and touches nothing', async () => {
    for (const call of calls()) {
      const res = await call();
      expect(res.status).toBe(409);
      expect((await res.json()).code).toBe('PORTAL_ORDERING_BLOCKED');
    }
    expect(resolvePortalCustomer).not.toHaveBeenCalled();
    expect(svc.orderAgain).not.toHaveBeenCalled();
    expect(svc.orderQuote).not.toHaveBeenCalled();
    expect(svc.listMyPrices).not.toHaveBeenCalled();
  });

  it('any value other than exactly "true" keeps the gate shut', async () => {
    for (const v of ['1', 'TRUE', 'yes', ' true']) {
      process.env.PORTAL_ORDERING_ENABLED = v;
      expect((await myPrices(req())).status).toBe(409);
    }
  });

  it('positive control: with the gate open, the same routes reach the handlers', async () => {
    process.env.PORTAL_ORDERING_ENABLED = 'true';
    const statuses = [];
    for (const call of calls()) statuses.push((await call()).status);
    expect(statuses).toEqual([200, 201, 200, 201]);
    expect(svc.orderAgain).toHaveBeenCalledWith('cust-a', 'past-a', undefined);
  });
});
