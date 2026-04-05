import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { activitiesApi } from '@/lib/api/activities';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('activitiesApi.list', () => {
  it('calls GET /api/activities with no params', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0 });
    await activitiesApi.list();
    expect(mockGet).toHaveBeenCalledWith('/api/activities');
  });

  it('appends activity_type and customer_id filters', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0 });
    await activitiesApi.list({ activity_type: 'call' as never, customer_id: 'cust-1' });
    const url = mockGet.mock.calls[0][0];
    expect(url).toContain('activity_type=call');
    expect(url).toContain('customer_id=cust-1');
  });

  it('appends include_completed filter', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0 });
    await activitiesApi.list({ include_completed: false });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('include_completed=false'));
  });
});

describe('activitiesApi.get', () => {
  it('calls GET /api/activities/:id', async () => {
    mockGet.mockResolvedValue({ id: 'act-1' });
    await activitiesApi.get('act-1');
    expect(mockGet).toHaveBeenCalledWith('/api/activities/act-1');
  });
});

describe('activitiesApi.create', () => {
  it('calls POST /api/activities', async () => {
    mockPost.mockResolvedValue({ id: 'act-1' });
    const data = { activity_type: 'call', subject: 'Test call', customer_id: 'cust-1' };
    await activitiesApi.create(data as never);
    expect(mockPost).toHaveBeenCalledWith('/api/activities', data);
  });
});

describe('activitiesApi.update', () => {
  it('calls PUT /api/activities/:id', async () => {
    mockPut.mockResolvedValue({ id: 'act-1' });
    await activitiesApi.update('act-1', { subject: 'Updated' } as never);
    expect(mockPut).toHaveBeenCalledWith('/api/activities/act-1', { subject: 'Updated' });
  });
});

describe('activitiesApi.delete', () => {
  it('calls DELETE /api/activities/:id', async () => {
    mockDelete.mockResolvedValue(undefined);
    await activitiesApi.delete('act-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/activities/act-1');
  });
});

describe('activitiesApi.complete', () => {
  it('calls POST /api/activities/:id/complete', async () => {
    mockPost.mockResolvedValue({ id: 'act-1', completed_at: '2026-01-01' });
    await activitiesApi.complete('act-1');
    expect(mockPost).toHaveBeenCalledWith('/api/activities/act-1/complete', {});
  });
});

describe('activitiesApi.getCustomerTimeline', () => {
  it('calls GET with default limit 20', async () => {
    mockGet.mockResolvedValue([]);
    await activitiesApi.getCustomerTimeline('cust-1');
    expect(mockGet).toHaveBeenCalledWith('/api/activities/customer/cust-1?limit=20');
  });

  it('accepts custom limit', async () => {
    mockGet.mockResolvedValue([]);
    await activitiesApi.getCustomerTimeline('cust-1', 50);
    expect(mockGet).toHaveBeenCalledWith('/api/activities/customer/cust-1?limit=50');
  });
});

describe('activitiesApi.getContactTimeline', () => {
  it('calls GET /api/activities/contact/:id', async () => {
    mockGet.mockResolvedValue([]);
    await activitiesApi.getContactTimeline('contact-1');
    expect(mockGet).toHaveBeenCalledWith('/api/activities/contact/contact-1?limit=20');
  });
});

describe('activitiesApi.getPendingTasks', () => {
  it('calls GET /api/activities/pending-tasks', async () => {
    mockGet.mockResolvedValue([]);
    await activitiesApi.getPendingTasks();
    expect(mockGet).toHaveBeenCalledWith('/api/activities/pending-tasks');
  });
});

describe('activitiesApi.getStats', () => {
  it('calls GET /api/activities/stats', async () => {
    mockGet.mockResolvedValue({ total: 100 });
    await activitiesApi.getStats();
    expect(mockGet).toHaveBeenCalledWith('/api/activities/stats');
  });
});
