import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { purchaseOrdersApi } from '@/lib/api/purchase-orders';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);

beforeEach(() => vi.clearAllMocks());

const mockPO = {
  id: 'po-1',
  po_number: 'PO-2026-001',
  supplier_id: 'sup-1',
  status: 'draft' as const,
  total: '8750.00',
  order_date: '2026-01-01',
  items: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockPaginated = {
  items: [mockPO],
  total: 1,
  page: 1,
  page_size: 50,
  total_pages: 1,
};

// ─── purchaseOrdersApi.list ────────────────────────

describe('purchaseOrdersApi.list', () => {
  it('calls GET /api/purchase-orders with no params', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await purchaseOrdersApi.list();
    expect(mockGet).toHaveBeenCalledWith('/api/purchase-orders?');
  });

  it('appends status filter', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await purchaseOrdersApi.list({ status: 'confirmed' });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('status=confirmed'));
  });

  it('appends supplier_id filter', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await purchaseOrdersApi.list({ supplier_id: 'sup-42' });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('supplier_id=sup-42'));
  });

  it('appends search filter', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await purchaseOrdersApi.list({ search: 'drill' });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('search=drill'));
  });

  it('returns paginated response', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    const result = await purchaseOrdersApi.list();
    expect(result.items[0].po_number).toBe('PO-2026-001');
    expect(result.total).toBe(1);
  });
});

// ─── purchaseOrdersApi.get ─────────────────────────

describe('purchaseOrdersApi.get', () => {
  it('calls GET /api/purchase-orders/:id', async () => {
    mockGet.mockResolvedValue(mockPO);
    await purchaseOrdersApi.get('po-1');
    expect(mockGet).toHaveBeenCalledWith('/api/purchase-orders/po-1');
  });

  it('returns the purchase order', async () => {
    mockGet.mockResolvedValue(mockPO);
    const result = await purchaseOrdersApi.get('po-1');
    expect(result.po_number).toBe('PO-2026-001');
  });
});

// ─── purchaseOrdersApi.create ──────────────────────

describe('purchaseOrdersApi.create', () => {
  it('calls POST /api/purchase-orders with data', async () => {
    mockPost.mockResolvedValue(mockPO);
    const payload = { supplier_id: 'sup-1', items: [] };
    await purchaseOrdersApi.create(payload);
    expect(mockPost).toHaveBeenCalledWith('/api/purchase-orders', payload);
  });

  it('returns created purchase order', async () => {
    mockPost.mockResolvedValue(mockPO);
    const result = await purchaseOrdersApi.create({ supplier_id: 'sup-1', items: [] });
    expect(result.id).toBe('po-1');
  });
});

// ─── purchaseOrdersApi.update ──────────────────────

describe('purchaseOrdersApi.update', () => {
  it('calls PUT /api/purchase-orders/:id', async () => {
    mockPut.mockResolvedValue(mockPO);
    const update = { notes: 'Urgent delivery needed' };
    await purchaseOrdersApi.update('po-1', update);
    expect(mockPut).toHaveBeenCalledWith('/api/purchase-orders/po-1', update);
  });
});

// ─── purchaseOrdersApi.delete ──────────────────────

describe('purchaseOrdersApi.delete', () => {
  it('calls DELETE /api/purchase-orders/:id', async () => {
    mockDelete.mockResolvedValue(undefined);
    await purchaseOrdersApi.delete('po-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/purchase-orders/po-1');
  });
});

// ─── purchaseOrdersApi.updateStatus ───────────────

describe('purchaseOrdersApi.updateStatus', () => {
  it('calls PUT /api/purchase-orders/:id/status', async () => {
    mockPut.mockResolvedValue({ ...mockPO, status: 'sent' as const });
    await purchaseOrdersApi.updateStatus('po-1', 'sent');
    expect(mockPut).toHaveBeenCalledWith('/api/purchase-orders/po-1/status', { status: 'sent' });
  });
});

// ─── purchaseOrdersApi.getReceipts ─────────────────

describe('purchaseOrdersApi.getReceipts', () => {
  it('calls GET /api/purchase-orders/:id/receipts', async () => {
    mockGet.mockResolvedValue([]);
    await purchaseOrdersApi.getReceipts('po-1');
    expect(mockGet).toHaveBeenCalledWith('/api/purchase-orders/po-1/receipts');
  });
});

// ─── purchaseOrdersApi.receiveStock ───────────────

describe('purchaseOrdersApi.receiveStock', () => {
  it('calls POST /api/purchase-orders/:id/receive', async () => {
    mockPost.mockResolvedValue([]);
    const payload = {
      items: [{ purchase_order_item_id: 'poi-1', quantity_received: 10 }],
      received_date: '2026-01-05',
    };
    await purchaseOrdersApi.receiveStock('po-1', payload);
    expect(mockPost).toHaveBeenCalledWith('/api/purchase-orders/po-1/receive', payload);
  });
});
