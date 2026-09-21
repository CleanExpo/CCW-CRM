/**
 * UNI-2747: portal prices and "order again", run through the REAL resolvePrice
 * against an in-memory prisma fake.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Product = {
  id: string;
  ownerUserId: string;
  sku: string;
  name: string;
  category: string | null;
  price: number;
  isActive: boolean;
};
type Line = {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};
type Order = {
  id: string;
  ownerUserId: string;
  customerId: string;
  orderNumber: string;
  status: string;
  total: number;
  lineItems: Line[];
};

const db = vi.hoisted(() => ({
  products: [] as Product[],
  customers: [] as { id: string; ownerUserId: string; isActive: boolean }[],
  tiers: [] as {
    customerId: string;
    priceListId: string;
    expiresAt: Date | null;
    priceList: Record<string, unknown>;
  }[],
  orders: [] as Order[],
  quotes: [] as Record<string, unknown>[],
}));

function inList(v: unknown, cond: unknown) {
  if (cond && typeof cond === 'object' && 'in' in (cond as object))
    return (cond as { in: unknown[] }).in.includes(v);
  return v === cond;
}
function matchProduct(p: Product, where: Record<string, unknown>) {
  for (const [k, v] of Object.entries(where)) {
    if (k === 'OR') continue; // search not used in these tests
    if (!['id', 'ownerUserId', 'isActive', 'sku'].includes(k))
      throw new Error(`fake: product.${k}`);
    if (!inList(p[k as keyof Product], v)) return false;
  }
  return true;
}

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    product: {
      findFirst: vi.fn(
        async ({ where }: { where: Record<string, unknown> }) =>
          db.products.find((p) => matchProduct(p, where)) ?? null
      ),
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        db.products.filter((p) => matchProduct(p, where))
      ),
      count: vi.fn(
        async ({ where }: { where: Record<string, unknown> }) =>
          db.products.filter((p) => matchProduct(p, where)).length
      ),
    },
    customer: {
      findFirst: vi.fn(
        async ({ where }: { where: { id: string } }) =>
          db.customers.find((c) => c.id === where.id && c.isActive) ?? null
      ),
    },
    customerPriceTier: {
      findUnique: vi.fn(
        async ({ where }: { where: { customerId: string } }) =>
          db.tiers.find((t) => t.customerId === where.customerId) ?? null
      ),
    },
    order: {
      findFirst: vi.fn(
        async ({ where }: { where: { id: string; customerId: string } }) =>
          db.orders.find((o) => o.id === where.id && o.customerId === where.customerId) ?? null
      ),
      create: vi.fn(
        async ({
          data,
        }: {
          data: Omit<Order, 'id' | 'lineItems'> & {
            lineItems: { create: Omit<Line, 'id' | 'orderId'>[] };
          };
        }) => {
          const id = `new-${db.orders.length}`;
          const o: Order = {
            ...data,
            id,
            lineItems: data.lineItems.create.map((l, i) => ({
              ...l,
              id: `${id}-l${i}`,
              orderId: id,
            })),
          };
          db.orders.push(o);
          return o;
        }
      ),
    },
    quote: {
      findFirst: vi.fn(
        async ({ where }: { where: { id: string; customerId: string } }) =>
          db.quotes.find((q) => q.id === where.id && q.customerId === where.customerId) ?? null
      ),
    },
  },
}));
vi.mock('@/lib/auth/workspace-scope', () => ({
  getWorkspaceMemberUserIds: vi.fn(async (owner: string) => [owner]),
}));

import { listMyPrices, orderAgain, orderQuote, PortalOrderError } from '@/lib/portal/my-price';
import { resolvePrice } from '@/lib/pricing/resolve-price';

const WS = 'ccw-owner';
const p = (id: string, price: number): Product => ({
  id,
  ownerUserId: WS,
  sku: id.toUpperCase(),
  name: id,
  category: null,
  price,
  isActive: true,
});
const list = (
  overrides: { product_id: string; unit_price: number }[],
  breaks: { product_id: string; min_qty: number; unit_price: number }[] = []
) => ({
  id: 'pl',
  name: 'Trade',
  isActive: true,
  priceOverrides: overrides,
  volumeBreaks: breaks,
});

beforeEach(() => {
  db.products = [p('soap', 100), p('wand', 50), { ...p('retired', 20), isActive: false }];
  db.customers = [
    { id: 'cust-a', ownerUserId: WS, isActive: true },
    { id: 'cust-b', ownerUserId: WS, isActive: true },
  ];
  db.tiers = [
    {
      customerId: 'cust-a',
      priceListId: 'pl-a',
      expiresAt: null,
      priceList: list(
        [{ product_id: 'soap', unit_price: 80 }],
        [{ product_id: 'wand', min_qty: 4, unit_price: 40 }]
      ),
    },
    {
      customerId: 'cust-b',
      priceListId: 'pl-b',
      expiresAt: null,
      priceList: list([{ product_id: 'soap', unit_price: 92 }]),
    },
  ];
  db.orders = [
    {
      id: 'past-a',
      ownerUserId: WS,
      customerId: 'cust-a',
      orderNumber: 'ORD-1',
      status: 'delivered',
      total: 0,
      lineItems: [
        {
          id: 'l1',
          orderId: 'past-a',
          productId: 'soap',
          quantity: 3,
          unitPrice: 75,
          lineTotal: 225,
        },
        {
          id: 'l2',
          orderId: 'past-a',
          productId: 'wand',
          quantity: 4,
          unitPrice: 55,
          lineTotal: 220,
        },
        {
          id: 'l3',
          orderId: 'past-a',
          productId: 'retired',
          quantity: 1,
          unitPrice: 20,
          lineTotal: 20,
        },
      ],
    },
  ];
  db.quotes = [];
});

describe('listMyPrices', () => {
  it('customer A and customer B see different prices for the same SKU, each equal to resolvePrice', async () => {
    const a = (await listMyPrices('cust-a', { page: 1, pageSize: 50 })).items.find(
      (i) => i.sku === 'SOAP'
    )!;
    const b = (await listMyPrices('cust-b', { page: 1, pageSize: 50 })).items.find(
      (i) => i.sku === 'SOAP'
    )!;
    expect(a.unit_price).not.toBe(b.unit_price);
    expect(a.unit_price).toBe((await resolvePrice('cust-a', 'soap', 1, [WS])).unitPrice);
    expect(b.unit_price).toBe((await resolvePrice('cust-b', 'soap', 1, [WS])).unitPrice);
    expect([a.unit_price, b.unit_price]).toEqual([80, 92]);
  });

  it('never lists an inactive product', async () => {
    const skus = (await listMyPrices('cust-a', { page: 1, pageSize: 50 })).items.map((i) => i.sku);
    expect(skus).not.toContain('RETIRED');
  });
});

describe('order again', () => {
  it('creates one draft order with identical lines at today’s price, not the old price', async () => {
    const { order, unavailable } = await orderAgain('cust-a', 'past-a');
    expect(order.status).toBe('draft');
    expect(order.customerId).toBe('cust-a');
    const lines = order.lineItems.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
    }));
    expect(lines).toEqual([
      {
        productId: 'soap',
        quantity: 3,
        unitPrice: (await resolvePrice('cust-a', 'soap', 3, [WS])).unitPrice,
      },
      {
        productId: 'wand',
        quantity: 4,
        unitPrice: (await resolvePrice('cust-a', 'wand', 4, [WS])).unitPrice,
      },
    ]);
    expect(lines.map((l) => l.unitPrice)).toEqual([80, 40]);
    expect(unavailable).toEqual(['retired']);
    expect(order.total).toBeCloseTo((3 * 80 + 4 * 40) * 1.1);
    expect(db.orders.filter((o) => o.id.startsWith('new-'))).toHaveLength(1);
  });

  it('can repeat a single line', async () => {
    const { order } = await orderAgain('cust-a', 'past-a', ['l2']);
    expect(order.lineItems.map((l) => l.productId)).toEqual(['wand']);
  });

  it('refuses another customer’s order and writes nothing', async () => {
    await expect(orderAgain('cust-b', 'past-a')).rejects.toBeInstanceOf(PortalOrderError);
    expect(db.orders).toHaveLength(1);
  });
});

describe('orderQuote', () => {
  it('honours quoted prices while the quote is valid, and uses today’s price once expired', async () => {
    const lines = [{ productId: 'soap', quantity: 2, unitPrice: 70 }];
    db.quotes = [
      {
        id: 'q-valid',
        customerId: 'cust-a',
        quoteNumber: 'Q1',
        validUntil: new Date(Date.now() + 86_400_000),
        lineItems: lines,
      },
      {
        id: 'q-old',
        customerId: 'cust-a',
        quoteNumber: 'Q2',
        validUntil: new Date(Date.now() - 86_400_000),
        lineItems: lines,
      },
    ];
    expect((await orderQuote('cust-a', 'q-valid')).order.lineItems[0].unitPrice).toBe(70);
    expect((await orderQuote('cust-a', 'q-old')).order.lineItems[0].unitPrice).toBe(80);
    await expect(orderQuote('cust-b', 'q-valid')).rejects.toBeInstanceOf(PortalOrderError);
  });
});
