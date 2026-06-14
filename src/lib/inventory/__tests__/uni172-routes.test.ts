/**
 * UNI-172: inventory forecast Create PO + reorder rule API coverage.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/auth/data-scope', () => ({
  requireAuthScope: vi.fn(),
}));

vi.mock('@/lib/auth/workspace-scope', () => ({
  getWorkspaceMemberUserIds: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    product: { findFirst: vi.fn(), findMany: vi.fn() },
    supplier: { findFirst: vi.fn() },
    purchaseOrder: { create: vi.fn() },
    productLocationStock: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/db/inventory-location-transfer', () => ({
  ensureProductLocationStockRows: vi.fn().mockResolvedValue(undefined),
  isWarehouseLocation: vi.fn((loc: string) => ['brisbane', 'sydney', 'melbourne'].includes(loc)),
  normalizeWarehouseLocation: vi.fn((loc: string) => loc),
}));

vi.mock('@/lib/db/inventory-product-view', () => ({
  expandWarehouseLocations: vi.fn(() => [
    {
      location: 'brisbane',
      available: 2,
      reorder_point: 10,
      reorder_quantity: 25,
    },
  ]),
}));

vi.mock('@/lib/db/inventory-api-helpers', () => ({
  INVENTORY_LOCATION_STOCK_SELECT: {},
  isMissingInventoryTableError: vi.fn(() => false),
  toProductLocationRows: vi.fn(() => []),
}));

import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { prisma } from '@/lib/db/prisma';
import { POST as autoReorderPost } from '@/app/api/inventory/auto-reorder/route';
import { GET as reorderRulesGet, POST as reorderRulesPost } from '@/app/api/inventory/reorder-rules/route';
import { PATCH as reorderSettingsPatch } from '@/app/api/inventory/reorder-settings/[productId]/[location]/route';

const OWNER = 'owner-uuid';
const PRODUCT_ID = 'product-uuid';

function setAuth(authenticated: boolean) {
  vi.mocked(requireAuthScope).mockResolvedValue(
    authenticated
      ? { userId: OWNER, role: 'owner', isAdmin: true }
      : null
  );
  vi.mocked(getWorkspaceMemberUserIds).mockResolvedValue([OWNER]);
}

describe('UNI-172 auto-reorder route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuth(true);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => fn(prisma));
  });

  it('returns 401 when not authenticated', async () => {
    setAuth(false);
    const res = await autoReorderPost(
      new Request('http://localhost/api/inventory/auto-reorder?product_id=x&location=brisbane', {
        method: 'POST',
      }) as never
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when product_id is missing', async () => {
    const res = await autoReorderPost(
      new Request('http://localhost/api/inventory/auto-reorder?location=brisbane', {
        method: 'POST',
      }) as never
    );
    expect(res.status).toBe(400);
  });

  it('creates a draft PO for a workspace product', async () => {
    vi.mocked(prisma.product.findFirst)
      .mockResolvedValueOnce({
        id: PRODUCT_ID,
        name: 'Widget',
        sku: 'WDG-1',
        price: 100,
        stock: 5,
        warehouseLocation: 'brisbane',
        locationStocks: [],
      } as never)
      .mockResolvedValueOnce({
        id: PRODUCT_ID,
        name: 'Widget',
        sku: 'WDG-1',
        price: 100,
        stock: 5,
        warehouseLocation: 'brisbane',
        locationStocks: [],
      } as never);
    vi.mocked(prisma.supplier.findFirst).mockResolvedValue({
      id: 'supplier-1',
      companyName: 'Acme',
    } as never);
    vi.mocked(prisma.purchaseOrder.create).mockResolvedValue({
      id: 'po-1',
      poNumber: 'PO-20260614-0001',
      status: 'draft',
    } as never);

    const res = await autoReorderPost(
      new Request(
        `http://localhost/api/inventory/auto-reorder?product_id=${PRODUCT_ID}&location=brisbane`,
        { method: 'POST' }
      ) as never
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.po_number).toBe('PO-20260614-0001');
    expect(prisma.purchaseOrder.create).toHaveBeenCalled();
  });

  it('returns 404 when product is outside the workspace', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue(null);
    const res = await autoReorderPost(
      new Request(
        `http://localhost/api/inventory/auto-reorder?product_id=${PRODUCT_ID}&location=brisbane`,
        { method: 'POST' }
      ) as never
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 when no supplier exists', async () => {
    vi.mocked(prisma.product.findFirst)
      .mockResolvedValueOnce({
        id: PRODUCT_ID,
        name: 'Widget',
        sku: 'WDG-1',
        price: 100,
        stock: 5,
        warehouseLocation: 'brisbane',
        locationStocks: [],
      } as never)
      .mockResolvedValueOnce({
        id: PRODUCT_ID,
        name: 'Widget',
        sku: 'WDG-1',
        price: 100,
        stock: 5,
        warehouseLocation: 'brisbane',
        locationStocks: [],
      } as never);
    vi.mocked(prisma.supplier.findFirst).mockResolvedValue(null);

    const res = await autoReorderPost(
      new Request(
        `http://localhost/api/inventory/auto-reorder?product_id=${PRODUCT_ID}&location=brisbane`,
        { method: 'POST' }
      ) as never
    );
    expect(res.status).toBe(400);
  });
});

describe('UNI-172 reorder-rules route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuth(true);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => fn(prisma));
  });

  it('returns 401 on GET when not authenticated', async () => {
    setAuth(false);
    const res = await reorderRulesGet(new Request('http://localhost/api/inventory/reorder-rules') as never);
    expect(res.status).toBe(401);
  });

  it('lists reorder rules scoped to workspace products', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      {
        id: PRODUCT_ID,
        locationStocks: [
          {
            id: 'pls-1',
            location: 'brisbane',
            autoApproveUnderQty: 5,
            leadTimeDays: 7,
            reorderEnabled: true,
          },
        ],
      },
    ] as never);

    const res = await reorderRulesGet(new Request('http://localhost/api/inventory/reorder-rules') as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].product_id).toBe(PRODUCT_ID);
  });

  it('updates reorder rule for a workspace product', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue({
      id: PRODUCT_ID,
      stock: 10,
      warehouseLocation: 'brisbane',
    } as never);
    vi.mocked(prisma.productLocationStock.update).mockResolvedValue({ id: 'pls-1' } as never);

    const res = await reorderRulesPost(
      new Request('http://localhost/api/inventory/reorder-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: PRODUCT_ID,
          location: 'brisbane',
          auto_approve_under_qty: 8,
          lead_time_days: 14,
          is_enabled: true,
        }),
      }) as never
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('pls-1');
  });

  it('returns 404 when updating rules for a product outside the workspace', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue(null);
    const res = await reorderRulesPost(
      new Request('http://localhost/api/inventory/reorder-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: PRODUCT_ID,
          location: 'brisbane',
          auto_approve_under_qty: 1,
          lead_time_days: 7,
        }),
      }) as never
    );
    expect(res.status).toBe(404);
  });
});

describe('UNI-172 reorder-settings route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuth(true);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => fn(prisma));
  });

  it('patches reorder point and quantity for a workspace product', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue({
      id: PRODUCT_ID,
      stock: 10,
      warehouseLocation: 'brisbane',
    } as never);
    vi.mocked(prisma.productLocationStock.update).mockResolvedValue({ id: 'pls-1' } as never);

    const res = await reorderSettingsPatch(
      new Request('http://localhost/api/inventory/reorder-settings/x/brisbane', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reorder_point: 12, reorder_quantity: 40 }),
      }) as never,
      { params: Promise.resolve({ productId: PRODUCT_ID, location: 'brisbane' }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
