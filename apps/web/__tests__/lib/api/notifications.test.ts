/**
 * Notifications API Client Tests
 *
 * Tests the type-safe notifications API client for listing,
 * unread counts, and marking notifications as read.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { notificationsApi } from '@/lib/api/notifications';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

beforeEach(() => vi.clearAllMocks());

// ─── List Notifications ─────────────────────────────────────────────

describe('notificationsApi.list', () => {
  it('calls GET /api/notifications with user_id', async () => {
    mockGet.mockResolvedValue([]);
    await notificationsApi.list('user-abc');
    expect(mockGet).toHaveBeenCalledWith('/api/notifications?user_id=user-abc');
  });

  it('returns notification array', async () => {
    const mockNotifs = [
      {
        id: 'n-1',
        user_id: 'user-abc',
        title: 'New order',
        message: 'Order ORD-2026-001 placed',
        notification_type: 'order',
        entity_type: 'order',
        entity_id: 'ord-1',
        is_read: false,
        created_at: '2026-03-10T10:00:00Z',
      },
    ];
    mockGet.mockResolvedValue(mockNotifs);
    const result = await notificationsApi.list('user-abc');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('New order');
    expect(result[0].is_read).toBe(false);
  });
});

// ─── Unread Count ───────────────────────────────────────────────────

describe('notificationsApi.unreadCount', () => {
  it('calls GET /api/notifications/unread-count with user_id', async () => {
    mockGet.mockResolvedValue({ count: 5 });
    await notificationsApi.unreadCount('user-abc');
    expect(mockGet).toHaveBeenCalledWith('/api/notifications/unread-count?user_id=user-abc');
  });

  it('returns count value', async () => {
    mockGet.mockResolvedValue({ count: 12 });
    const result = await notificationsApi.unreadCount('user-abc');
    expect(result.count).toBe(12);
  });
});

// ─── Mark Read ──────────────────────────────────────────────────────

describe('notificationsApi.markRead', () => {
  it('posts to /api/notifications/:id/read', async () => {
    mockPost.mockResolvedValue({ id: 'n-1', is_read: true });
    await notificationsApi.markRead('n-1');
    expect(mockPost).toHaveBeenCalledWith('/api/notifications/n-1/read', {});
  });

  it('returns updated notification', async () => {
    const updated = { id: 'n-1', is_read: true, title: 'Test' };
    mockPost.mockResolvedValue(updated);
    const result = await notificationsApi.markRead('n-1');
    expect(result.is_read).toBe(true);
  });
});

// ─── Mark All Read ──────────────────────────────────────────────────

describe('notificationsApi.markAllRead', () => {
  it('posts to /api/notifications/read-all with user_id', async () => {
    mockPost.mockResolvedValue({ status: 'ok', user_id: 'user-abc' });
    await notificationsApi.markAllRead('user-abc');
    expect(mockPost).toHaveBeenCalledWith('/api/notifications/read-all?user_id=user-abc', {});
  });

  it('returns status and user_id', async () => {
    mockPost.mockResolvedValue({ status: 'ok', user_id: 'user-abc' });
    const result = await notificationsApi.markAllRead('user-abc');
    expect(result.status).toBe('ok');
    expect(result.user_id).toBe('user-abc');
  });
});

// ─── Error propagation ──────────────────────────────────────────────

describe('error handling', () => {
  it('propagates errors from list', async () => {
    mockGet.mockRejectedValue(new Error('Forbidden'));
    await expect(notificationsApi.list('user-1')).rejects.toThrow('Forbidden');
  });

  it('propagates errors from markRead', async () => {
    mockPost.mockRejectedValue(new Error('Not found'));
    await expect(notificationsApi.markRead('bad-id')).rejects.toThrow('Not found');
  });
});
