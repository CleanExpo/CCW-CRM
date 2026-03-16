import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

import { cin7FulfilmentApi } from '@/lib/api/cin7-fulfilment';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPatch = vi.mocked(apiClient.patch);

beforeEach(() => vi.clearAllMocks());

describe('cin7FulfilmentApi.listFulfilments', () => {
  it('calls GET /api/cin7/fulfilments', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0 });
    await cin7FulfilmentApi.listFulfilments();
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/cin7/fulfilments'));
  });
});

describe('cin7FulfilmentApi.createFulfilment', () => {
  it('calls POST /api/cin7/fulfilments', async () => {
    mockPost.mockResolvedValue({ id: 'ful-1' });
    const data = { order_mapping_id: 'om-1' };
    await cin7FulfilmentApi.createFulfilment(data as never);
    expect(mockPost).toHaveBeenCalledWith('/api/cin7/fulfilments', data);
  });
});

describe('cin7FulfilmentApi.updateFulfilmentStatus', () => {
  it('calls PATCH /api/cin7/fulfilments/:id/status', async () => {
    mockPatch.mockResolvedValue({ id: 'ful-1', status: 'shipped' });
    await cin7FulfilmentApi.updateFulfilmentStatus('ful-1', { status: 'shipped' } as never);
    expect(mockPatch).toHaveBeenCalledWith('/api/cin7/fulfilments/ful-1/status', {
      status: 'shipped',
    });
  });
});

describe('cin7FulfilmentApi.listInvoices', () => {
  it('calls GET /api/cin7/invoices', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0 });
    await cin7FulfilmentApi.listInvoices();
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/cin7/invoices'));
  });
});

describe('cin7FulfilmentApi.syncInvoices', () => {
  it('calls POST /api/cin7/invoices/sync', async () => {
    mockPost.mockResolvedValue({ synced: 3 });
    await cin7FulfilmentApi.syncInvoices();
    expect(mockPost).toHaveBeenCalledWith('/api/cin7/invoices/sync', expect.anything());
  });
});

describe('cin7FulfilmentApi.listPayments', () => {
  it('calls GET /api/cin7/payments', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0 });
    await cin7FulfilmentApi.listPayments();
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/cin7/payments'));
  });
});
