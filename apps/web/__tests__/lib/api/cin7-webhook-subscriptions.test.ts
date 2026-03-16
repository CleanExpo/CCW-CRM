import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import {
  listWebhookSubscriptions,
  createWebhookSubscription,
  updateWebhookSubscription,
  deleteWebhookSubscription,
} from '@/lib/api/cin7-webhook-subscriptions';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPatch = vi.mocked(apiClient.patch);
const mockDelete = vi.mocked(apiClient.delete);

beforeEach(() => vi.clearAllMocks());

describe('listWebhookSubscriptions', () => {
  it('calls GET /api/cin7/webhook-subscriptions', async () => {
    mockGet.mockResolvedValue([]);
    await listWebhookSubscriptions();
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('/api/cin7/webhook-subscriptions')
    );
  });
});

describe('createWebhookSubscription', () => {
  it('calls POST /api/cin7/webhook-subscriptions', async () => {
    mockPost.mockResolvedValue({ id: 'ws-1' });
    const data = { event_type: 'order.created', target_url: 'https://example.com/webhook' };
    await createWebhookSubscription(data as never);
    expect(mockPost).toHaveBeenCalledWith('/api/cin7/webhook-subscriptions', data);
  });
});

describe('updateWebhookSubscription', () => {
  it('calls PATCH /api/cin7/webhook-subscriptions/:id', async () => {
    mockPatch.mockResolvedValue({ id: 'ws-1', is_active: false });
    await updateWebhookSubscription('ws-1', { is_active: false } as never);
    expect(mockPatch).toHaveBeenCalledWith('/api/cin7/webhook-subscriptions/ws-1', {
      is_active: false,
    });
  });
});

describe('deleteWebhookSubscription', () => {
  it('calls DELETE /api/cin7/webhook-subscriptions/:id', async () => {
    mockDelete.mockResolvedValue(undefined);
    await deleteWebhookSubscription('ws-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/cin7/webhook-subscriptions/ws-1');
  });
});
