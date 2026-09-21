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
  customers: [] as {
    id: string;
    ownerUserId: string;
    isActive: boolean;
    creditLimitAUD?: number | null;
  }[],
  invoices: [] as { customerId: string; status: string; total: number; amountPaid: number }[],
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
    invoice: {
      aggregate: vi.fn(
        async ({ where }: { where: { customerId: string; status: { notIn: string[] } } }) => {
          const rows = db.invoices.filter(
            (i) => i.customerId === where.customerId && !where.status.notIn.includes(i.status)
          );
          return {
            _sum: {
              total: rows.length ? rows.reduce((s, i) => s + i.total, 0) : null,
              amountPaid: rows.length ? rows.reduce((s, i) => s + i.amountPaid, 0) : null,
            },
          };
        }
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
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string; customerId: string; status: string | { in: string[] } };
          data: { status: string };
        }) => {
          // Exact, case-sensitive match, as Postgres does.
          const statusOk = (s: string) =>
            typeof where.status === 'string' ? s === where.status : where.status.in.includes(s);
          const q = db.quotes.find(
            (x) =>
              x.id === where.id && x.customerId === where.customerId && statusOk(x.status as string)
          );
          if (!q) return { count: 0 };
          q.status = data.status;
          return { count: 1 };
        }
      ),
    },
    // Runs the callback against the same fake; a thrown error leaves earlier writes,
    // which is stricter than Postgres, so a test passing here also passes with rollback.
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const { prisma } = await import('@/lib/db/prisma');
      return fn(prisma);
    }),
  },
}));
vi.mock('@/lib/auth/workspace-scope', () => ({
  getWorkspaceMemberUserIds: vi.fn(async (owner: string) => [owner]),
}));

import {
  getQuoteCart,
  listMyPrices,
  orderAgain,
  orderQuote,
  PortalOrderError,
  quoteStillValid,
} from '@/lib/portal/my-price';
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
  db.invoices = [];
});

describe('credit limit on portal orders', () => {
  it('refuses an order that would take the customer over their credit limit, and writes nothing', async () => {
    db.customers[0].creditLimitAUD = 500;
    db.invoices = [{ customerId: 'cust-a', status: 'sent', total: 200, amountPaid: 0 }];
    // (3 x 80 + 4 x 40) x 1.1 = 440; 200 outstanding + 440 > 500.
    const err = await orderAgain('cust-a', 'past-a').catch((e) => e);
    expect(err).toBeInstanceOf(PortalOrderError);
    expect(err.status).toBe(402);
    expect(db.orders.filter((o) => o.id.startsWith('new-'))).toHaveLength(0);
  });

  it('counts only unpaid parts of live invoices, like the staff order form', async () => {
    db.customers[0].creditLimitAUD = 500;
    db.invoices = [
      { customerId: 'cust-a', status: 'sent', total: 200, amountPaid: 150 },
      { customerId: 'cust-a', status: 'paid', total: 900, amountPaid: 900 },
      { customerId: 'cust-a', status: 'draft', total: 900, amountPaid: 0 },
      { customerId: 'cust-b', status: 'sent', total: 900, amountPaid: 0 },
    ];
    // 50 outstanding + 440 = 490, within 500.
    const { order } = await orderAgain('cust-a', 'past-a');
    expect(order.status).toBe('draft');
  });

  it('places the order when the customer has no credit limit set', async () => {
    db.invoices = [{ customerId: 'cust-a', status: 'sent', total: 100_000, amountPaid: 0 }];
    const { order } = await orderAgain('cust-a', 'past-a');
    expect(order.status).toBe('draft');
  });

  it('applies the same check to a quote ordered from the portal', async () => {
    db.customers[0].creditLimitAUD = 100;
    db.quotes = [
      {
        id: 'q-credit',
        customerId: 'cust-a',
        quoteNumber: 'QC',
        status: 'sent',
        validUntil: new Date(Date.now() + 86_400_000),
        lineItems: [{ productId: 'soap', quantity: 2, unitPrice: 70 }],
      },
    ];
    const err = await orderQuote('cust-a', 'q-credit').catch((e) => e);
    expect(err).toBeInstanceOf(PortalOrderError);
    expect(err.status).toBe(402);
    expect(db.orders.filter((o) => o.id.startsWith('new-'))).toHaveLength(0);
  });
});

describe('quoteStillValid', () => {
  // Staff save valid_until as a date-only string, stored as UTC midnight of that date.
  const expiresOn = new Date('2026-09-21');

  it('is valid for the whole of the expiry date in Brisbane', () => {
    expect(quoteStillValid(expiresOn, new Date('2026-09-21T00:01:00+10:00'))).toBe(true);
    expect(quoteStillValid(expiresOn, new Date('2026-09-21T15:00:00+10:00'))).toBe(true);
    expect(quoteStillValid(expiresOn, new Date('2026-09-21T23:59:00+10:00'))).toBe(true);
  });

  it('expires once the next day starts in Brisbane', () => {
    expect(quoteStillValid(expiresOn, new Date('2026-09-22T00:00:00+10:00'))).toBe(false);
  });

  it('treats a valid_until with a time of day by its Brisbane date', () => {
    const at = new Date('2026-09-21T14:30:00Z'); // 22/09 00:30 in Brisbane
    expect(quoteStillValid(at, new Date('2026-09-22T12:00:00+10:00'))).toBe(true);
    expect(quoteStillValid(at, new Date('2026-09-23T00:00:00+10:00'))).toBe(false);
  });

  it('is never valid without a date', () => {
    expect(quoteStillValid(null)).toBe(false);
  });
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
        status: 'sent',
        validUntil: new Date(Date.now() + 86_400_000),
        lineItems: lines,
      },
      {
        id: 'q-old',
        customerId: 'cust-a',
        quoteNumber: 'Q2',
        status: 'sent',
        validUntil: new Date(Date.now() - 86_400_000),
        lineItems: lines,
      },
    ];
    await expect(orderQuote('cust-b', 'q-valid')).rejects.toBeInstanceOf(PortalOrderError);
    expect((await orderQuote('cust-a', 'q-valid')).order.lineItems[0].unitPrice).toBe(70);
    expect((await orderQuote('cust-a', 'q-old')).order.lineItems[0].unitPrice).toBe(80);
  });

  it('a quote can be ordered only once, and is marked converted', async () => {
    db.quotes = [
      {
        id: 'q1',
        customerId: 'cust-a',
        quoteNumber: 'Q1',
        status: 'sent',
        validUntil: new Date(Date.now() + 86_400_000),
        lineItems: [{ productId: 'soap', quantity: 1, unitPrice: 70 }],
      },
    ];
    await orderQuote('cust-a', 'q1');
    await expect(orderQuote('cust-a', 'q1')).rejects.toThrow(/no longer be ordered|already/);
    expect(db.quotes[0].status).toBe('converted');
    expect(db.orders.filter((o) => o.id.startsWith('new-'))).toHaveLength(1);
  });

  it('orders a quote whose status is stored with different casing ("Sent")', async () => {
    db.quotes = [
      {
        id: 'qc',
        customerId: 'cust-a',
        quoteNumber: 'QC',
        status: 'Sent',
        validUntil: new Date(Date.now() + 86_400_000),
        lineItems: [{ productId: 'soap', quantity: 1, unitPrice: 70 }],
      },
    ];
    const { order } = await orderQuote('cust-a', 'qc');
    expect(order.status).toBe('draft');
    expect(db.quotes[0].status).toBe('converted');
  });

  it('refuses draft, rejected, expired and cancelled quotes and writes nothing', async () => {
    for (const status of ['draft', 'rejected', 'expired', 'cancelled', 'converted']) {
      db.quotes = [
        {
          id: 'qx',
          customerId: 'cust-a',
          quoteNumber: 'QX',
          status,
          validUntil: new Date(Date.now() + 86_400_000),
          lineItems: [{ productId: 'soap', quantity: 1, unitPrice: 70 }],
        },
      ];
      await expect(orderQuote('cust-a', 'qx')).rejects.toBeInstanceOf(PortalOrderError);
    }
    expect(db.orders).toHaveLength(1);
  });

  it('refuses a quote with a product that can no longer be ordered, and leaves it unconverted', async () => {
    db.quotes = [
      {
        id: 'q-retired',
        customerId: 'cust-a',
        quoteNumber: 'QR',
        status: 'sent',
        validUntil: new Date(Date.now() + 86_400_000),
        lineItems: [
          { productId: 'soap', quantity: 1, unitPrice: 70 },
          { productId: 'retired', quantity: 2, unitPrice: 20 },
        ],
      },
    ];
    const err = await orderQuote('cust-a', 'q-retired').catch((e) => e);
    expect(err).toBeInstanceOf(PortalOrderError);
    expect(err.status).toBe(409);
    expect(db.quotes[0].status).toBe('sent');
    expect(db.orders.filter((o) => o.id.startsWith('new-'))).toHaveLength(0);
  });

  it('refuses when a product is retired between the check and the write', async () => {
    db.quotes = [
      {
        id: 'q-race',
        customerId: 'cust-a',
        quoteNumber: 'QX',
        status: 'sent',
        validUntil: new Date(Date.now() + 86_400_000),
        lineItems: [
          { productId: 'soap', quantity: 1, unitPrice: 70 },
          { productId: 'wand', quantity: 1, unitPrice: 50 },
        ],
      },
    ];
    const { prisma } = await import('@/lib/db/prisma');
    vi.mocked(prisma.$transaction).mockImplementationOnce((async (
      fn: (tx: unknown) => Promise<unknown>
    ) => {
      db.products.find((x) => x.id === 'wand')!.isActive = false;
      return fn(prisma);
    }) as never);
    const err = await orderQuote('cust-a', 'q-race').catch((e) => e);
    expect(err).toBeInstanceOf(PortalOrderError);
    expect(err.status).toBe(409);
  });
});

describe('getQuoteCart', () => {
  const line = (productId: string, name: string) => ({
    productId,
    quantity: 1,
    unitPrice: 70,
    product: { name, sku: name.toUpperCase() },
  });

  it('flags lines that can no longer be ordered and says the quote cannot be ordered online', async () => {
    db.quotes = [
      {
        id: 'q-cart',
        customerId: 'cust-a',
        quoteNumber: 'QC',
        status: 'sent',
        validUntil: new Date(Date.now() + 86_400_000),
        lineItems: [line('soap', 'soap'), line('retired', 'retired')],
      },
    ];
    const cart = await getQuoteCart('cust-a', 'q-cart');
    expect(cart.orderable).toBe(false);
    expect(cart.lines.map((l) => [l.product_id, l.available])).toEqual([
      ['soap', true],
      ['retired', false],
    ]);
  });

  it('is orderable when every line can be ordered', async () => {
    db.quotes = [
      {
        id: 'q-ok',
        customerId: 'cust-a',
        quoteNumber: 'QO',
        status: 'sent',
        validUntil: new Date(Date.now() + 86_400_000),
        lineItems: [line('soap', 'soap'), line('wand', 'wand')],
      },
    ];
    const cart = await getQuoteCart('cust-a', 'q-ok');
    expect(cart.orderable).toBe(true);
    expect(cart.lines.every((l) => l.available)).toBe(true);
  });
});
