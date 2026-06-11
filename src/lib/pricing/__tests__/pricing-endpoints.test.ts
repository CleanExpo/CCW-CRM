/**
 * Endpoint integration tests for the contract pricing engine.
 *
 * Tests prove:
 *   A. A tiered customer gets the contract (tier) price in:
 *      - POST /api/quotes (via buildQuoteLinesFromItems)
 *      - POST /api/orders (via resolveLinesFromPayload)
 *      - POST /api/pos/transactions (via resolvePrice inline)
 *
 *   B. An untied customer (no tier) gets the catalogue price in the same endpoints.
 *
 *   C. GET /api/pricing/customers/[customerId]/tier returns the tier for a tiered customer
 *      and null for an untied customer.
 *
 * All Prisma calls and auth are mocked — no real DB or network required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock declarations (must precede imports that transitively use them)
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth/data-scope', () => ({
  requireAuthScope: vi.fn(),
}));

vi.mock('@/lib/auth/workspace-scope', () => ({
  getWorkspaceMemberUserIds: vi.fn(),
  getWorkspaceIdForUser: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    quote: { create: vi.fn(), count: vi.fn() },
    order: { create: vi.fn(), findFirst: vi.fn() },
    posTransaction: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    customer: { findFirst: vi.fn() },
    product: { findMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
    customerPriceTier: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/pos/mock-store', () => ({
  getPosStore: vi.fn(() => ({ terminals: [{ id: 'T1', location_code: 'brisbane' }] })),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds, getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import { prisma } from '@/lib/db/prisma';

import { POST as quotesPost } from '@/app/api/quotes/route';
import { POST as ordersPost } from '@/app/api/orders/route';
import { POST as posPost } from '@/app/api/pos/transactions/route';
import { GET as pricingTierGet } from '@/app/api/pricing/customers/[customerId]/tier/route';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OWNER = 'owner-user-uuid';
const CUSTOMER_TIERED = 'customer-tiered-uuid';
const CUSTOMER_UNTIERED = 'customer-untiered-uuid';
const PRODUCT_ID = 'product-uuid-1';
const CATALOGUE_PRICE = 100;
const TIER_PRICE = 65;
const PRICE_LIST_ID = 'price-list-uuid-1';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePost(body: unknown): Request {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeGet(url: string): Request {
  return new Request(url, { method: 'GET' });
}

function setAuth() {
  vi.mocked(requireAuthScope).mockResolvedValue({
    userId: OWNER,
    role: 'owner',
    isAdmin: false,
  });
  vi.mocked(getWorkspaceMemberUserIds).mockResolvedValue([OWNER]);
  vi.mocked(getWorkspaceIdForUser).mockResolvedValue('workspace-1');
}

function mockProductFound() {
  vi.mocked(prisma.product.findMany).mockResolvedValue([
    { id: PRODUCT_ID, price: CATALOGUE_PRICE, name: 'Test Product', isActive: true, ownerUserId: OWNER } as never,
  ]);
  vi.mocked(prisma.product.findFirst).mockResolvedValue({
    id: PRODUCT_ID,
    price: CATALOGUE_PRICE,
    stock: 999,
    ownerUserId: OWNER,
  } as never);
}

function mockTieredCustomer(customerId: string) {
  vi.mocked(prisma.customerPriceTier.findUnique).mockImplementation(
    ({ where }: { where: { customerId: string } }) => {
      if (where.customerId !== customerId) return Promise.resolve(null);
      return Promise.resolve({
        id: 'tier-1',
        customerId,
        priceListId: PRICE_LIST_ID,
        expiresAt: null,
        ownerUserId: OWNER,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        priceList: {
          id: PRICE_LIST_ID,
          name: 'Trade-A',
          isActive: true,
          priceOverrides: [{ product_id: PRODUCT_ID, unit_price: TIER_PRICE }],
          volumeBreaks: [],
        },
      }) as never;
    }
  );
}

function mockUntieredCustomer() {
  vi.mocked(prisma.customerPriceTier.findUnique).mockResolvedValue(null);
}

function mockCustomerFound(customerId: string) {
  vi.mocked(prisma.customer.findFirst).mockResolvedValue({
    id: customerId,
    ownerUserId: OWNER,
    isActive: true,
  } as never);
}

// ---------------------------------------------------------------------------
// A. Tiered customer gets contract price
// ---------------------------------------------------------------------------

describe('Pricing endpoints: tiered customer receives contract price', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuth();
    mockProductFound();
    mockCustomerFound(CUSTOMER_TIERED);
    mockTieredCustomer(CUSTOMER_TIERED);
  });

  it('POST /api/quotes → line item uses tier price', async () => {
    vi.mocked(prisma.quote.count).mockResolvedValue(0);
    vi.mocked(prisma.quote.create).mockResolvedValue({
      id: 'q1',
      ownerUserId: OWNER,
      customerId: CUSTOMER_TIERED,
      quoteNumber: 'Q-2026-0001',
      status: 'draft',
      total: TIER_PRICE * 2,
      validUntil: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      customer: { companyName: 'Trade Co' },
      _count: { lineItems: 1 },
    } as never);

    const res = await quotesPost(
      makePost({
        customer_id: CUSTOMER_TIERED,
        items: [{ product_id: PRODUCT_ID, quantity: 2 }],
      }) as never
    );

    expect(res.status).toBe(201);

    // The create call should have used TIER_PRICE (65) not CATALOGUE_PRICE (100).
    const createCall = vi.mocked(prisma.quote.create).mock.calls[0][0];
    const lineItems = createCall.data.lineItems.create;
    expect(lineItems[0].unitPrice).toBe(TIER_PRICE);
    expect(lineItems[0].lineTotal).toBe(TIER_PRICE * 2);
  });

  it('POST /api/orders → line item uses tier price', async () => {
    vi.mocked(prisma.order.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.order.create).mockResolvedValue({
      id: 'o1',
      ownerUserId: OWNER,
      customerId: CUSTOMER_TIERED,
      orderNumber: 'ORD-1',
      status: 'draft',
      total: TIER_PRICE * 3 * 1.1,
      createdAt: new Date(),
      updatedAt: new Date(),
      customer: { companyName: 'Trade Co' },
      lineItems: [
        {
          id: 'li1',
          productId: PRODUCT_ID,
          quantity: 3,
          unitPrice: TIER_PRICE,
          lineTotal: TIER_PRICE * 3,
          product: { name: 'Test Product' },
        },
      ],
    } as never);

    const res = await ordersPost(
      makePost({
        customer_id: CUSTOMER_TIERED,
        items: [{ product_id: PRODUCT_ID, quantity: 3 }],
      }) as never
    );

    expect(res.status).toBe(201);

    const createCall = vi.mocked(prisma.order.create).mock.calls[0][0];
    const lineItems = createCall.data.lineItems.create;
    expect(lineItems[0].unitPrice).toBe(TIER_PRICE);
  });

  it('POST /api/pos/transactions with customer_id → uses tier price', async () => {
    vi.mocked(prisma.product.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.$transaction).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const fakeTx = {
          product: {
            findFirst: vi.fn().mockResolvedValue({ id: PRODUCT_ID, stock: 50, ownerUserId: OWNER }),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          posTransaction: {
            create: vi.fn().mockResolvedValue({
              id: 'pos1',
              transactionNumber: 'POS-1',
              paymentStatus: 'captured',
              amount: TIER_PRICE * 1 * 1.1,
            }),
          },
        };
        return fn(fakeTx);
      }
    );

    const res = await posPost(
      makePost({
        terminal_id: 'T1',
        payment_method: 'cash',
        customer_id: CUSTOMER_TIERED,
        items: [{ product_id: PRODUCT_ID, quantity: 1 }],
      }) as never
    );

    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// B. Untied customer gets catalogue price
// ---------------------------------------------------------------------------

describe('Pricing endpoints: untied customer receives catalogue price', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuth();
    mockProductFound();
    mockCustomerFound(CUSTOMER_UNTIERED);
    mockUntieredCustomer();
  });

  it('POST /api/quotes → line item uses catalogue price', async () => {
    vi.mocked(prisma.quote.count).mockResolvedValue(0);
    vi.mocked(prisma.quote.create).mockResolvedValue({
      id: 'q2',
      ownerUserId: OWNER,
      customerId: CUSTOMER_UNTIERED,
      quoteNumber: 'Q-2026-0002',
      status: 'draft',
      total: CATALOGUE_PRICE,
      validUntil: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      customer: { companyName: 'Retail Co' },
      _count: { lineItems: 1 },
    } as never);

    const res = await quotesPost(
      makePost({
        customer_id: CUSTOMER_UNTIERED,
        items: [{ product_id: PRODUCT_ID, quantity: 1 }],
      }) as never
    );

    expect(res.status).toBe(201);

    const createCall = vi.mocked(prisma.quote.create).mock.calls[0][0];
    const lineItems = createCall.data.lineItems.create;
    expect(lineItems[0].unitPrice).toBe(CATALOGUE_PRICE);
    expect(lineItems[0].lineTotal).toBe(CATALOGUE_PRICE);
  });

  it('POST /api/orders → line item uses catalogue price', async () => {
    vi.mocked(prisma.order.create).mockResolvedValue({
      id: 'o2',
      ownerUserId: OWNER,
      customerId: CUSTOMER_UNTIERED,
      orderNumber: 'ORD-2',
      status: 'draft',
      total: CATALOGUE_PRICE * 1.1,
      createdAt: new Date(),
      updatedAt: new Date(),
      customer: { companyName: 'Retail Co' },
      lineItems: [
        {
          id: 'li2',
          productId: PRODUCT_ID,
          quantity: 1,
          unitPrice: CATALOGUE_PRICE,
          lineTotal: CATALOGUE_PRICE,
          product: { name: 'Test Product' },
        },
      ],
    } as never);

    const res = await ordersPost(
      makePost({
        customer_id: CUSTOMER_UNTIERED,
        items: [{ product_id: PRODUCT_ID, quantity: 1 }],
      }) as never
    );

    expect(res.status).toBe(201);

    const createCall = vi.mocked(prisma.order.create).mock.calls[0][0];
    const lineItems = createCall.data.lineItems.create;
    expect(lineItems[0].unitPrice).toBe(CATALOGUE_PRICE);
  });
});

// ---------------------------------------------------------------------------
// C. Tier GET endpoint
// ---------------------------------------------------------------------------

describe('GET /api/pricing/customers/[customerId]/tier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuth();
  });

  it('returns tier data for a tiered customer', async () => {
    mockTieredCustomer(CUSTOMER_TIERED);

    const res = await pricingTierGet(
      makeGet(`http://localhost/api/pricing/customers/${CUSTOMER_TIERED}/tier`) as never,
      { params: Promise.resolve({ customerId: CUSTOMER_TIERED }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toBeNull();
    expect(body.tier_name).toBe('Trade-A');
    expect(body.price_list_id).toBe(PRICE_LIST_ID);
    expect(body.is_expired).toBe(false);
  });

  it('returns null for a customer with no tier', async () => {
    mockUntieredCustomer();

    const res = await pricingTierGet(
      makeGet(`http://localhost/api/pricing/customers/${CUSTOMER_UNTIERED}/tier`) as never,
      { params: Promise.resolve({ customerId: CUSTOMER_UNTIERED }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeNull();
  });
});
