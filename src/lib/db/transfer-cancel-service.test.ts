/**
 * Unit tests for transfer-cancel-service
 * Uses relative imports (vitest has no @/ alias configured).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Prisma mock helpers ----
const mockFindFirst = vi.fn();
const mockUpdateMany = vi.fn();
const mockUpdate = vi.fn();
const mockSyncProductStockTotal = vi.fn();

// We hold a reference to the $transaction mock so we can reset it in beforeEach
const mockTransaction = vi.fn();

vi.mock('./prisma', () => ({
  prisma: {
    stockTransfer: { findFirst: mockFindFirst },
    $transaction: mockTransaction,
  },
}));

vi.mock('./inventory-location-transfer', () => ({
  syncProductStockTotal: mockSyncProductStockTotal,
}));

// ---- Module under test ----
const { cancelTransfer } = await import('./transfer-cancel-service');

// Helper: build the fake TX object used inside the transaction callback
function makeTx() {
  return {
    productLocationStock: { updateMany: mockUpdateMany },
    stockTransfer: { update: mockUpdate },
  };
}

// Default $transaction: passes callback a fake tx and returns its result
function defaultTxImpl(cb: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) {
  return cb(makeTx());
}

const WS_USERS = ['user-abc'];

describe('cancelTransfer service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(defaultTxImpl);
  });

  // ---- 404 ----
  it('returns 404 when the transfer is not found (org scope miss)', async () => {
    mockFindFirst.mockResolvedValue(null);

    const result = await cancelTransfer({ id: 'no-such', workspaceUserIds: WS_USERS });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.detail).toMatch(/not found/i);
    }
  });

  // ---- 409: completed ----
  it('returns 409 for a "completed" transfer and does not touch stock', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'tf-done', status: 'completed', productId: 'p1',
      fromLocation: 'brisbane', toLocation: 'sydney', quantity: 10,
    });

    const result = await cancelTransfer({ id: 'tf-done', workspaceUserIds: WS_USERS });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.detail).toMatch(/completed/i);
    }
    // No stock mutations — transaction is never entered
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  // ---- 409: already cancelled ----
  it('returns 409 for an already "cancelled" transfer and does not touch stock', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'tf-cx', status: 'cancelled', productId: 'p1',
      fromLocation: 'brisbane', toLocation: 'sydney', quantity: 5,
    });

    const result = await cancelTransfer({ id: 'tf-cx', workspaceUserIds: WS_USERS });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.detail).toMatch(/already cancelled/i);
    }
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  // ---- pending: cancel without stock rollback ----
  it('cancels a "pending" transfer: sets status=cancelled, does NOT adjust stock', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'tf-pend', status: 'pending', productId: 'p2',
      fromLocation: 'sydney', toLocation: 'melbourne', quantity: 8,
    });

    mockUpdate.mockResolvedValue({
      id: 'tf-pend', status: 'cancelled', productId: 'p2',
      fromLocation: 'sydney', toLocation: 'melbourne', quantity: 8,
      reason: null, notes: null,
      updatedAt: new Date('2026-06-11T00:00:00Z'),
      product: { name: 'Widget', sku: 'WGT-001' },
    });

    const result = await cancelTransfer({ id: 'tf-pend', workspaceUserIds: WS_USERS });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.transfer.status).toBe('cancelled');
      expect(result.transfer.id).toBe('tf-pend');
    }

    // Pending: stock was never moved — no location updates
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockSyncProductStockTotal).not.toHaveBeenCalled();

    // Only the StockTransfer record is set to cancelled
    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockUpdate.mock.calls[0][0]).toMatchObject({
      where: { id: 'tf-pend' },
      data: { status: 'cancelled' },
    });
  });

  // ---- in_transit: cancel WITH stock rollback ----
  it('cancels an "in_transit" transfer: restores fromLocation, decrements toLocation', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'tf-tr', status: 'in_transit', productId: 'p3',
      fromLocation: 'brisbane', toLocation: 'sydney', quantity: 20,
    });

    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockUpdate.mockResolvedValue({
      id: 'tf-tr', status: 'cancelled', productId: 'p3',
      fromLocation: 'brisbane', toLocation: 'sydney', quantity: 20,
      reason: null, notes: null,
      updatedAt: new Date('2026-06-11T00:00:00Z'),
      product: { name: 'Gadget', sku: 'GDG-002' },
    });

    const result = await cancelTransfer({ id: 'tf-tr', workspaceUserIds: WS_USERS });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.transfer.status).toBe('cancelled');
    }

    // Exactly two stock mutations: restore source, undo destination
    expect(mockUpdateMany).toHaveBeenCalledTimes(2);

    type UpdateManyArg = {
      where: { productId: string; location: string };
      data: { quantity: { increment?: number; decrement?: number } };
    };
    const [fromCall, toCall] = mockUpdateMany.mock.calls as [UpdateManyArg[], UpdateManyArg[]][number][];

    // fromLocation (brisbane) incremented — stock restored
    expect(fromCall[0]).toMatchObject({
      where: { productId: 'p3', location: 'brisbane' },
      data: { quantity: { increment: 20 } },
    });

    // toLocation (sydney) decremented — move undone
    expect(toCall[0]).toMatchObject({
      where: { productId: 'p3', location: 'sydney' },
      data: { quantity: { decrement: 20 } },
    });

    // Product stock total must be re-synced after in_transit rollback
    expect(mockSyncProductStockTotal).toHaveBeenCalledOnce();
    expect(mockSyncProductStockTotal).toHaveBeenCalledWith(expect.anything(), 'p3');
  });

  // ---- org scoping ----
  it('enforces org scoping: workspaceUserIds passed to findFirst', async () => {
    mockFindFirst.mockResolvedValue(null);

    await cancelTransfer({ id: 'tf-org', workspaceUserIds: ['u1', 'u2'] });

    expect(mockFindFirst).toHaveBeenCalledOnce();
    const arg = mockFindFirst.mock.calls[0][0] as {
      where: { id: string; product: { ownerUserId: { in: string[] } } };
    };
    expect(arg.where.id).toBe('tf-org');
    expect(arg.where.product.ownerUserId.in).toEqual(['u1', 'u2']);
  });
});
