/**
 * UNI-2108 backend smoke: same API paths the Playwright pack walks.
 * Mocks only. Does not change handlers.
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/data-scope', () => ({ requireAuthScope: vi.fn() }));
vi.mock('@/lib/auth/workspace-scope', () => ({
  getWorkspaceMemberUserIds: vi.fn(),
  getWorkspaceIdForUser: vi.fn(),
}));
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    product: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    customer: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    quote: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
    order: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
    invoice: { findMany: vi.fn(), count: vi.fn() },
    posTransaction: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('@/lib/db/quote-mutations', () => ({
  buildQuoteLinesFromItems: vi
    .fn()
    .mockResolvedValue([{ productId: 'p1', quantity: 1, unitPrice: 10, lineTotal: 10 }]),
  nextQuoteNumber: vi.fn().mockResolvedValue('Q-1'),
}));
vi.mock('@/lib/db/order-lines', () => ({
  generateOrderNumber: vi.fn(() => 'SO-1'),
  resolveLinesFromPayload: vi.fn().mockResolvedValue({
    lines: [{ productId: 'p1', quantity: 1, unitPrice: 10, lineTotal: 10 }],
    subtotal: 10,
  }),
}));
vi.mock('@/lib/comms/operational-events', () => ({ logOperationalEvent: vi.fn() }));
vi.mock('@/lib/workflows/workflow-engine', () => ({ dispatchWorkflowTrigger: vi.fn() }));
vi.mock('@/lib/inventory/stock-movement', () => ({
  parseSaleBranch: vi.fn(() => 'brisbane'),
  recordStockMovements: vi.fn(),
}));
vi.mock('@/lib/pos/mock-store', () => ({
  getPosStore: vi.fn(() => ({
    terminals: [{ id: 'term-1', location_code: 'brisbane' }],
  })),
}));
vi.mock('@/lib/pricing/resolve-price', () => ({
  resolvePrice: vi.fn().mockResolvedValue({ unitPrice: 10 }),
}));
vi.mock('@/lib/db/inventory-location-transfer', () => ({
  ensureProductLocationStockRows: vi.fn(),
  isWarehouseLocation: vi.fn((s: string) => ['brisbane', 'sydney', 'melbourne'].includes(s)),
  normalizeWarehouseLocation: vi.fn((s: string) => s),
  syncProductStockTotal: vi.fn(),
}));
vi.mock('@/lib/db/inventory-api-helpers', () => ({
  isMissingInventoryTableError: vi.fn(() => false),
}));

import { GET as customerGet, PATCH as customerPatch } from '@/app/api/customers/[customerId]/route';
import { GET as customersGet, POST as customersPost } from '@/app/api/customers/route';
import { POST as adjustPost } from '@/app/api/inventory/adjust/route';
import { POST as reservePost } from '@/app/api/inventory/reserve/route';
import { POST as transferPost } from '@/app/api/inventory/transfer/route';
import { GET as invoicesGet } from '@/app/api/invoices/route';
import { GET as posGet, POST as posPost } from '@/app/api/pos/transactions/route';
import { GET as productGet, PATCH as productPatch } from '@/app/api/products/[id]/route';
import { GET as productsGet, POST as productsPost } from '@/app/api/products/route';
import { GET as quotesGet, POST as quotesPost } from '@/app/api/quotes/route';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser, getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { prisma } from '@/lib/db/prisma';

const NOW = new Date('2026-09-22T00:00:00.000Z');
const OWNER = '00000000-0000-0000-0000-000000000001';

function authOn() {
  vi.mocked(requireAuthScope).mockResolvedValue({
    userId: OWNER,
    role: 'owner',
    isAdmin: true,
  } as never);
  vi.mocked(getWorkspaceMemberUserIds).mockResolvedValue([OWNER]);
  vi.mocked(getWorkspaceIdForUser).mockResolvedValue(OWNER);
}

function productRow() {
  return {
    id: 'prod-1',
    name: 'Pump',
    sku: 'SKU-1',
    category: 'equipment',
    price: 10,
    stock: 5,
    isActive: true,
    warehouseLocation: 'brisbane',
    createdAt: NOW,
    updatedAt: NOW,
    ownerUserId: OWNER,
  };
}

function customerRow() {
  return {
    id: 'cust-1',
    companyName: 'Acme',
    contactName: 'Pat',
    email: 'pat@acme.test',
    phone: null,
    city: 'Brisbane',
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    ownerUserId: OWNER,
    cin7ContactId: null,
    cin7ContactType: null,
    creditLimitAUD: null,
    creditTermsDays: null,
    creditTermsType: null,
  };
}

function req(url: string, init?: RequestInit) {
  return new NextRequest(url, init);
}

describe('UNI-2108 API smoke routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authOn();
  });

  it('rejects products without a session', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(null);
    const res = await productsGet(req('http://localhost/api/products'));
    expect(res.status).toBe(401);
  });

  it('lists and creates a product, then reads and patches it', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([productRow()] as never);
    vi.mocked(prisma.product.count).mockResolvedValue(1);
    const list = await productsGet(req('http://localhost/api/products'));
    expect(list.status).toBe(200);
    expect((await list.json()).items[0].sku).toBe('SKU-1');

    vi.mocked(prisma.product.create).mockResolvedValue(productRow() as never);
    const created = await productsPost(
      req('http://localhost/api/products', {
        method: 'POST',
        body: JSON.stringify({ name: 'Pump', sku: 'SKU-1', price: 10 }),
      })
    );
    expect(created.status).toBe(201);

    vi.mocked(prisma.product.findFirst).mockResolvedValue(productRow() as never);
    const one = await productGet(req('http://localhost/api/products/prod-1'), {
      params: Promise.resolve({ id: 'prod-1' }),
    });
    expect(one.status).toBe(200);

    vi.mocked(prisma.product.update).mockResolvedValue({
      ...productRow(),
      name: 'Pump 2',
    } as never);
    const patched = await productPatch(
      req('http://localhost/api/products/prod-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Pump 2' }),
      }),
      { params: Promise.resolve({ id: 'prod-1' }) }
    );
    expect(patched.status).toBe(200);
    expect((await patched.json()).name).toBe('Pump 2');
  });

  it('lists and creates a customer, then reads and patches it', async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([customerRow()] as never);
    vi.mocked(prisma.customer.count).mockResolvedValue(1);
    expect((await customersGet(req('http://localhost/api/customers'))).status).toBe(200);

    vi.mocked(prisma.customer.create).mockResolvedValue(customerRow() as never);
    const created = await customersPost(
      req('http://localhost/api/customers', {
        method: 'POST',
        body: JSON.stringify({ company_name: 'Acme' }),
      })
    );
    expect(created.status).toBe(201);

    vi.mocked(prisma.customer.findFirst).mockResolvedValue(customerRow() as never);
    expect(
      (
        await customerGet(req('http://localhost/api/customers/cust-1'), {
          params: Promise.resolve({ customerId: 'cust-1' }),
        })
      ).status
    ).toBe(200);

    vi.mocked(prisma.customer.update).mockResolvedValue({
      ...customerRow(),
      companyName: 'Acme Pty',
    } as never);
    const patched = await customerPatch(
      req('http://localhost/api/customers/cust-1', {
        method: 'PATCH',
        body: JSON.stringify({ company_name: 'Acme Pty' }),
      }),
      { params: Promise.resolve({ customerId: 'cust-1' }) }
    );
    expect((await patched.json()).company_name).toBe('Acme Pty');
  });

  it('lists and creates a quote', async () => {
    vi.mocked(prisma.quote.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.quote.count).mockResolvedValue(0);
    expect((await quotesGet(req('http://localhost/api/quotes'))).status).toBe(200);

    vi.mocked(prisma.customer.findFirst).mockResolvedValue({ id: 'cust-1' } as never);
    vi.mocked(prisma.quote.create).mockResolvedValue({
      id: 'q1',
      customerId: 'cust-1',
      quoteNumber: 'Q-1',
      status: 'draft',
      total: 10,
      validUntil: null,
      notes: null,
      createdAt: NOW,
      updatedAt: NOW,
      ownerUserId: OWNER,
      customer: { companyName: 'Acme' },
      _count: { lineItems: 1 },
    } as never);
    const created = await quotesPost(
      req('http://localhost/api/quotes', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: 'cust-1',
          items: [{ product_id: 'p1', quantity: 1 }],
        }),
      })
    );
    expect(created.status).toBe(201);
  });

  it('lists invoices as JSON and as CSV', async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.invoice.count).mockResolvedValue(0);
    expect((await invoicesGet(req('http://localhost/api/invoices'))).status).toBe(200);
    const csv = await invoicesGet(req('http://localhost/api/invoices?format=csv'));
    expect(csv.status).toBe(200);
    expect(csv.headers.get('content-type') || '').toMatch(/csv/);
  });

  it('lists and creates a POS sale', async () => {
    vi.mocked(prisma.posTransaction.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.posTransaction.count).mockResolvedValue(0);
    expect((await posGet(req('http://localhost/api/pos/transactions'))).status).toBe(200);

    vi.mocked(prisma.posTransaction.create).mockResolvedValue({
      id: 'pos-1',
      transactionNumber: 'POS-1',
      paymentStatus: 'captured',
      amount: 20,
    } as never);
    const created = await posPost(
      req('http://localhost/api/pos/transactions', {
        method: 'POST',
        body: JSON.stringify({ terminal_id: 'term-1', amount: 20, payment_method: 'cash' }),
      })
    );
    expect(created.status).toBe(200);
  });

  it('rejects inventory adjust without a product', async () => {
    const res = await adjustPost(
      req('http://localhost/api/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
  });

  it('rejects reserve and transfer without required fields', async () => {
    expect(
      (
        await reservePost(
          req('http://localhost/api/inventory/reserve', {
            method: 'POST',
            body: JSON.stringify({}),
          })
        )
      ).status
    ).toBe(400);
    expect(
      (
        await transferPost(
          req('http://localhost/api/inventory/transfer', {
            method: 'POST',
            body: JSON.stringify({}),
          })
        )
      ).status
    ).toBe(400);
  });
});
