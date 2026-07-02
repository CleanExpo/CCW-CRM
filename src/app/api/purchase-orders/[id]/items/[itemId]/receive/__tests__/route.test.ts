/**
 * UNI-2119: PO item receive must move stock into the PO's delivery warehouse
 * (ProductLocationStock), not just the global Product.stock counter, and must
 * reject duplicate/over-receipt.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/auth/data-scope', () => ({
  requireAuthScope: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    purchaseOrderLine: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    product: { update: vi.fn() },
    productLocationStock: { upsert: vi.fn() },
    purchaseOrder: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/db/purchase-order-serialize', () => ({
  purchaseOrderToApi: vi.fn((po: unknown) => po),
}));

import { requireAuthScope } from '@/lib/auth/data-scope';
import { prisma } from '@/lib/db/prisma';
import { POST as receivePost } from '@/app/api/purchase-orders/[id]/items/[itemId]/receive/route';

const OWNER = 'owner-uuid';
const PO_ID = 'po-uuid';
const LINE_ID = 'line-uuid';
const PRODUCT_ID = 'product-uuid';

function makeRequest(body: unknown) {
  return new Request(`http://localhost/api/purchase-orders/${PO_ID}/items/${LINE_ID}/receive`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  }) as never;
}

const params = { params: Promise.resolve({ id: PO_ID, itemId: LINE_ID }) };

function makeLine(overrides: Partial<{ quantity: number; quantityReceived: number; deliveryLocation: string }> = {}) {
  return {
    id: LINE_ID,
    purchaseOrderId: PO_ID,
    productId: PRODUCT_ID,
    quantity: overrides.quantity ?? 10,
    quantityReceived: overrides.quantityReceived ?? 0,
    product: { id: PRODUCT_ID },
    purchaseOrder: { deliveryLocation: overrides.deliveryLocation ?? 'Sydney' },
  };
}

describe('UNI-2119 PO item receive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuthScope).mockResolvedValue({ userId: OWNER, role: 'owner', isAdmin: true } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => fn(prisma));
    vi.mocked(prisma.purchaseOrderLine.findMany).mockResolvedValue([makeLine()] as never);
    vi.mocked(prisma.purchaseOrder.update).mockResolvedValue({ id: PO_ID } as never);
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(null as never);
    const res = await receivePost(makeRequest({ quantity_received: 1 }), params);
    expect(res.status).toBe(401);
  });

  it('returns 400 when quantity_received is missing or zero', async () => {
    const res = await receivePost(makeRequest({}), params);
    expect(res.status).toBe(400);
  });

  it('returns 404 when the line does not exist for this owner', async () => {
    vi.mocked(prisma.purchaseOrderLine.findFirst).mockResolvedValue(null as never);
    const res = await receivePost(makeRequest({ quantity_received: 1 }), params);
    expect(res.status).toBe(404);
  });

  it('rejects duplicate receipt: receiving again after full receipt returns 400', async () => {
    vi.mocked(prisma.purchaseOrderLine.findFirst).mockResolvedValue(
      makeLine({ quantity: 10, quantityReceived: 10 }) as never
    );
    const res = await receivePost(makeRequest({ quantity_received: 5 }), params);
    expect(res.status).toBe(400);
    expect(prisma.productLocationStock.upsert).not.toHaveBeenCalled();
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('moves received stock into the PO delivery warehouse (normalized location)', async () => {
    vi.mocked(prisma.purchaseOrderLine.findFirst).mockResolvedValue(
      makeLine({ quantity: 10, quantityReceived: 0, deliveryLocation: 'Sydney' }) as never
    );
    const res = await receivePost(makeRequest({ quantity_received: 4 }), params);
    expect(res.status).toBe(200);

    expect(prisma.productLocationStock.upsert).toHaveBeenCalledWith({
      where: { productId_location: { productId: PRODUCT_ID, location: 'sydney' } },
      update: { quantity: { increment: 4 } },
      create: { productId: PRODUCT_ID, location: 'sydney', quantity: 4 },
    });
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: PRODUCT_ID },
      data: { stock: { increment: 4 } },
    });
    expect(prisma.purchaseOrderLine.update).toHaveBeenCalledWith({
      where: { id: LINE_ID },
      data: { quantityReceived: 4 },
    });
  });

  it('defaults unknown delivery locations to the primary warehouse', async () => {
    vi.mocked(prisma.purchaseOrderLine.findFirst).mockResolvedValue(
      makeLine({ deliveryLocation: 'Springfield Depot' }) as never
    );
    const res = await receivePost(makeRequest({ quantity_received: 2 }), params);
    expect(res.status).toBe(200);
    expect(prisma.productLocationStock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId_location: { productId: PRODUCT_ID, location: 'brisbane' } },
      })
    );
  });

  it('marks the PO received when all lines are fully received', async () => {
    vi.mocked(prisma.purchaseOrderLine.findFirst).mockResolvedValue(
      makeLine({ quantity: 10, quantityReceived: 6 }) as never
    );
    vi.mocked(prisma.purchaseOrderLine.findMany).mockResolvedValue([
      { id: LINE_ID, quantity: 10, quantityReceived: 6 },
    ] as never);
    const res = await receivePost(makeRequest({ quantity_received: 4 }), params);
    expect(res.status).toBe(200);
    expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'received' }),
      })
    );
  });
});
