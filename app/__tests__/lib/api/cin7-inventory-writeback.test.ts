import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

import { cin7InventoryWritebackApi } from '@/lib/api/cin7-inventory-writeback';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

beforeEach(() => vi.clearAllMocks());

describe('cin7InventoryWritebackApi.createStockAdjustment', () => {
  it('calls POST /api/cin7/stock-adjustments', async () => {
    mockPost.mockResolvedValue({ id: 'sa-1' });
    const data = { product_sku: 'SKU-001', quantity_change: -5, reason: 'Damage' };
    await cin7InventoryWritebackApi.createStockAdjustment(data as never);
    expect(mockPost).toHaveBeenCalledWith('/api/cin7/stock-adjustments', data);
  });
});

describe('cin7InventoryWritebackApi.listStockAdjustments', () => {
  it('calls GET /api/cin7/stock-adjustments', async () => {
    mockGet.mockResolvedValue([]);
    await cin7InventoryWritebackApi.listStockAdjustments();
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/cin7/stock-adjustments'));
  });
});

describe('cin7InventoryWritebackApi.createStockTransfer', () => {
  it('calls POST /api/cin7/stock-transfers', async () => {
    mockPost.mockResolvedValue({ id: 'st-1' });
    const data = { product_sku: 'SKU-001', from_location: 'SYD', to_location: 'MEL', quantity: 10 };
    await cin7InventoryWritebackApi.createStockTransfer(data as never);
    expect(mockPost).toHaveBeenCalledWith('/api/cin7/stock-transfers', data);
  });
});

describe('cin7InventoryWritebackApi.listStockTransfers', () => {
  it('calls GET /api/cin7/stock-transfers', async () => {
    mockGet.mockResolvedValue([]);
    await cin7InventoryWritebackApi.listStockTransfers();
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/cin7/stock-transfers'));
  });
});
