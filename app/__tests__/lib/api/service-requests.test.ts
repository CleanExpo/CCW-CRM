import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import {
  getServiceRequests,
  getServiceRequest,
  createServiceRequest,
  updateServiceRequest,
  deleteServiceRequest,
} from '@/lib/api/service-requests';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPatch = vi.mocked(apiClient.patch);
const mockDelete = vi.mocked(apiClient.delete);

beforeEach(() => vi.clearAllMocks());

describe('getServiceRequests', () => {
  it('calls GET /api/service-requests', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0 });
    await getServiceRequests();
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/service-requests'));
  });
});

describe('getServiceRequest', () => {
  it('calls GET /api/service-requests/:id', async () => {
    mockGet.mockResolvedValue({ id: 'sr-1' });
    await getServiceRequest('sr-1');
    expect(mockGet).toHaveBeenCalledWith('/api/service-requests/sr-1');
  });
});

describe('createServiceRequest', () => {
  it('calls POST /api/service-requests', async () => {
    mockPost.mockResolvedValue({ id: 'sr-1' });
    const data = { title: 'Fix pump', customer_id: 'cust-1' };
    await createServiceRequest(data as never);
    expect(mockPost).toHaveBeenCalledWith('/api/service-requests', data);
  });
});

describe('updateServiceRequest', () => {
  it('calls PATCH /api/service-requests/:id', async () => {
    mockPatch.mockResolvedValue({ id: 'sr-1', status: 'completed' });
    await updateServiceRequest('sr-1', { status: 'completed' } as never);
    expect(mockPatch).toHaveBeenCalledWith('/api/service-requests/sr-1', { status: 'completed' });
  });
});

describe('deleteServiceRequest', () => {
  it('calls DELETE /api/service-requests/:id', async () => {
    mockDelete.mockResolvedValue(undefined);
    await deleteServiceRequest('sr-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/service-requests/sr-1');
  });
});
