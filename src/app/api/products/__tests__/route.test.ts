/**
 * UNI-2108: Core ERP Smoke Pack — Products slice.
 *
 * First narrow slice of the smoke pack: covers the products list/create API
 * surface (`src/app/api/products/route.ts`) since it is the most foundational
 * CRUD module (no cross-module dependencies) and already has GET + POST
 * handlers implemented.
 *
 * Scope of this file:
 *  - GET  /api/products : auth gate, workspace scoping, search/category filters, pagination shape
 *  - POST /api/products : auth gate, create + response shape (201)
 *
 * Explicitly NOT covered here (see UNI-2108 ticket for follow-up slices):
 *  - PUT/PATCH update or DELETE for a single product -- as of this commit there is
 *    no `src/app/api/products/[id]/route.ts`, so "update" from the ticket's
 *    acceptance criteria is not yet implemented at the API level for products.
 *    This is a real gap, not an oversight in this test file.
 *  - customers, quotes, orders, POS transactions, inventory reservation/transfer,
 *    invoice export -- separate slices.
 *  - True Playwright browser E2E -- no @playwright/test dependency or e2e/
 *    harness exists yet in this repo; this file is a vitest API-level smoke
 *    test standing in as the first, smallest-safe-fix slice.
 *
 * Follows the established mocking pattern used across this repo's route tests
 * (see src/lib/inventory/__tests__/uni172-routes.test.ts and
 * src/lib/pos/__tests__/pos-route-auth.test.ts): mock @/lib/db/prisma and the
 * auth-scope/workspace-scope modules, then import and call the route handlers
 * directly with a constructed NextRequest -- no real DB or JWT needed.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/data-scope', () => ({
  requireAuthScope: vi.fn(),
}));

vi.mock('@/lib/auth/workspace-scope', () => ({
  getWorkspaceMemberUserIds: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    product: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { prisma } from '@/lib/db/prisma';
import { GET as productsGet, POST as productsPost } from '@/app/api/products/route';

const OWNER = 'owner-uuid';

function setAuth(authenticated: boolean, workspaceUserIds: string[] = [OWNER]) {
  vi.mocked(requireAuthScope).mockResolvedValue(
    authenticated ? { userId: OWNER, role: 'owner', isAdmin: true } : null
  );
  vi.mocked(getWorkspaceMemberUserIds).mockResolvedValue(workspaceUserIds);
}

function makeGetRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/products${query}`, { method: 'GET' });
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeProductRow(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'product-1',
    ownerUserId: OWNER,
    name: 'Cordless Drill',
    sku: 'DRILL-001',
    category: 'power_tools',
    price: 149.99,
    stock: 25,
    isActive: true,
    warehouseLocation: 'brisbane',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('GET /api/products', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    setAuth(false);

    const res = await productsGet(makeGetRequest());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.detail).toBe('Not authenticated');
  });

  it('returns a paginated list scoped to the workspace', async () => {
    setAuth(true, [OWNER]);
    const rows = [makeProductRow()];
    vi.mocked(prisma.product.findMany).mockResolvedValue(rows as never);
    vi.mocked(prisma.product.count).mockResolvedValue(1);

    const res = await productsGet(makeGetRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      total: 1,
      page: 1,
      page_size: 50,
      total_pages: 1,
    });
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      id: 'product-1',
      sku: 'DRILL-001',
      name: 'Cordless Drill',
    });

    // Workspace scoping: findMany must filter by the resolved workspace member ids.
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ownerUserId: { in: [OWNER] },
          isActive: true,
        }),
      })
    );
  });

  it('applies search filter across name and sku', async () => {
    setAuth(true, [OWNER]);
    vi.mocked(prisma.product.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.product.count).mockResolvedValue(0);

    await productsGet(makeGetRequest('?search=drill'));

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: 'drill', mode: 'insensitive' } },
            { sku: { contains: 'drill', mode: 'insensitive' } },
          ],
        }),
      })
    );
  });

  it('applies category filter', async () => {
    setAuth(true, [OWNER]);
    vi.mocked(prisma.product.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.product.count).mockResolvedValue(0);

    await productsGet(makeGetRequest('?category=power_tools'));

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: 'power_tools' }),
      })
    );
  });

  it('respects page and page_size pagination params', async () => {
    setAuth(true, [OWNER]);
    vi.mocked(prisma.product.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.product.count).mockResolvedValue(120);

    const res = await productsGet(makeGetRequest('?page=2&page_size=25'));
    const body = await res.json();

    expect(body.page).toBe(2);
    expect(body.page_size).toBe(25);
    expect(body.total_pages).toBe(5);
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 25, take: 25 })
    );
  });

  it('caps page_size at 200 even if a larger value is requested', async () => {
    setAuth(true, [OWNER]);
    vi.mocked(prisma.product.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.product.count).mockResolvedValue(0);

    await productsGet(makeGetRequest('?page_size=999'));

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 })
    );
  });

  it('excludes inactive products by default and includes them with include_inactive=true', async () => {
    setAuth(true, [OWNER]);
    vi.mocked(prisma.product.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.product.count).mockResolvedValue(0);

    await productsGet(makeGetRequest('?include_inactive=true'));

    const call = vi.mocked(prisma.product.findMany).mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(call.where.isActive).toBeUndefined();
  });
});

describe('POST /api/products', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    setAuth(false);

    const res = await productsPost(makePostRequest({ name: 'New Product', sku: 'NEW-001' }));

    expect(res.status).toBe(401);
  });

  it('creates a product and returns 201 with the serialized product', async () => {
    setAuth(true, [OWNER]);
    const created = makeProductRow({
      id: 'product-2',
      name: 'Impact Wrench',
      sku: 'IMPACT-002',
      price: 249.5,
      stock: 10,
    });
    vi.mocked(prisma.product.create).mockResolvedValue(created as never);

    const res = await productsPost(
      makePostRequest({
        name: 'Impact Wrench',
        sku: 'IMPACT-002',
        category: 'power_tools',
        price: 249.5,
        stock: 10,
        warehouse_location: 'brisbane',
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      id: 'product-2',
      name: 'Impact Wrench',
      sku: 'IMPACT-002',
      price: 249.5,
      stock: 10,
    });

    expect(prisma.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerUserId: OWNER,
        name: 'Impact Wrench',
        sku: 'IMPACT-002',
        category: 'power_tools',
        price: 249.5,
        stock: 10,
        isActive: true,
        warehouseLocation: 'brisbane',
      }),
    });
  });

  it('defaults optional fields (price, stock, is_active) when omitted', async () => {
    setAuth(true, [OWNER]);
    vi.mocked(prisma.product.create).mockResolvedValue(makeProductRow() as never);

    await productsPost(makePostRequest({ name: 'Bare Bones', sku: 'BB-001' }));

    expect(prisma.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Bare Bones',
        sku: 'BB-001',
        category: null,
        price: 0,
        stock: 0,
        isActive: true,
        warehouseLocation: null,
      }),
    });
  });

  it('returns 500 with a detail message when prisma create fails', async () => {
    setAuth(true, [OWNER]);
    vi.mocked(prisma.product.create).mockRejectedValue(new Error('db unavailable'));

    const res = await productsPost(makePostRequest({ name: 'X', sku: 'X-1' }));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.detail).toContain('db unavailable');
  });
});
