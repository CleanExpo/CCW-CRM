import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import { outboundShipmentsApi } from '@/lib/api/shipments-outbound';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);

beforeEach(() => vi.clearAllMocks());

describe('outboundShipmentsApi.list', () => {
  it('calls GET /api/shipments/outbound', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0 });
    await outboundShipmentsApi.list();
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/shipments/outbound'));
  });
});

describe('outboundShipmentsApi.get', () => {
  it('calls GET /api/shipments/outbound/:id', async () => {
    mockGet.mockResolvedValue({ id: 'ship-1' });
    await outboundShipmentsApi.get('ship-1');
    expect(mockGet).toHaveBeenCalledWith('/api/shipments/outbound/ship-1');
  });
});

describe('outboundShipmentsApi.create', () => {
  it('calls POST /api/shipments/outbound', async () => {
    mockPost.mockResolvedValue({ id: 'ship-1' });
    const data = { order_id: 'ord-1', carrier: 'AusPost' };
    await outboundShipmentsApi.create(data as never);
    expect(mockPost).toHaveBeenCalledWith('/api/shipments/outbound', data);
  });
});

describe('outboundShipmentsApi.update', () => {
  it('calls PUT /api/shipments/outbound/:id', async () => {
    mockPut.mockResolvedValue({ id: 'ship-1' });
    await outboundShipmentsApi.update('ship-1', { tracking_number: 'TRK-123' } as never);
    expect(mockPut).toHaveBeenCalledWith('/api/shipments/outbound/ship-1', {
      tracking_number: 'TRK-123',
    });
  });
});

describe('outboundShipmentsApi.delete', () => {
  it('calls DELETE /api/shipments/outbound/:id', async () => {
    mockDelete.mockResolvedValue(undefined);
    await outboundShipmentsApi.delete('ship-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/shipments/outbound/ship-1');
  });
});
