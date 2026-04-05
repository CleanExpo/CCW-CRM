import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

import { cin7GrnApi } from '@/lib/api/cin7-grn';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockDelete = vi.mocked(apiClient.delete);

beforeEach(() => vi.clearAllMocks());

describe('cin7GrnApi.createGoodsReceipt', () => {
  it('calls POST /api/cin7/goods-receipts', async () => {
    mockPost.mockResolvedValue({ id: 'grn-1' });
    const data = { po_mapping_id: 'po-1' };
    await cin7GrnApi.createGoodsReceipt(data as never);
    expect(mockPost).toHaveBeenCalledWith('/api/cin7/goods-receipts', data);
  });
});

describe('cin7GrnApi.listGoodsReceipts', () => {
  it('calls GET /api/cin7/goods-receipts', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0 });
    await cin7GrnApi.listGoodsReceipts();
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/cin7/goods-receipts'));
  });
});

describe('cin7GrnApi.getGoodsReceipt', () => {
  it('calls GET /api/cin7/goods-receipts/:id', async () => {
    mockGet.mockResolvedValue({ id: 'grn-1' });
    await cin7GrnApi.getGoodsReceipt('grn-1');
    expect(mockGet).toHaveBeenCalledWith('/api/cin7/goods-receipts/grn-1');
  });
});

describe('cin7GrnApi.addGoodsReceiptLine', () => {
  it('calls POST /api/cin7/goods-receipts/:id/lines', async () => {
    mockPost.mockResolvedValue({ id: 'line-1' });
    const data = { product_sku: 'SKU-001', quantity: 10 };
    await cin7GrnApi.addGoodsReceiptLine('grn-1', data as never);
    expect(mockPost).toHaveBeenCalledWith('/api/cin7/goods-receipts/grn-1/lines', data);
  });
});

describe('cin7GrnApi.removeGoodsReceiptLine', () => {
  it('calls DELETE /api/cin7/goods-receipts/:grnId/lines/:lineId', async () => {
    mockDelete.mockResolvedValue(undefined);
    await cin7GrnApi.removeGoodsReceiptLine('grn-1', 'line-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/cin7/goods-receipts/grn-1/lines/line-1');
  });
});

describe('cin7GrnApi.confirmGoodsReceipt', () => {
  it('calls POST /api/cin7/goods-receipts/:id/confirm', async () => {
    mockPost.mockResolvedValue({ id: 'grn-1', status: 'confirmed' });
    await cin7GrnApi.confirmGoodsReceipt('grn-1');
    expect(mockPost).toHaveBeenCalledWith('/api/cin7/goods-receipts/grn-1/confirm');
  });
});
