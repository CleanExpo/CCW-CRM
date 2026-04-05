import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock apiClient before importing ordersApi
vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { ordersApi } from '@/lib/api/orders';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);

const mockOrder = {
  id: 'order-1',
  order_number: 'ORD-2026-001',
  customer_id: 'cust-1',
  status: 'pending' as const,
  total: '1500.00',
  order_date: '2026-01-01',
  items: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockPaginated = {
  items: [mockOrder],
  total: 1,
  page: 1,
  page_size: 50,
  total_pages: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ordersApi.list', () => {
  it('calls GET /api/orders with no params', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await ordersApi.list();
    expect(mockGet).toHaveBeenCalledWith('/api/orders?');
  });

  it('appends page and page_size to query string', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await ordersApi.list({ page: 2, page_size: 25 });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('page=2'));
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('page_size=25'));
  });

  it('appends status filter to query string', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await ordersApi.list({ status: 'pending' });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('status=pending'));
  });

  it('appends search filter to query string', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await ordersApi.list({ search: 'test' });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('search=test'));
  });

  it('returns the paginated response', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    const result = await ordersApi.list();
    expect(result).toEqual(mockPaginated);
  });
});

describe('ordersApi.get', () => {
  it('calls GET /api/orders/:id', async () => {
    mockGet.mockResolvedValue(mockOrder);
    await ordersApi.get('order-1');
    expect(mockGet).toHaveBeenCalledWith('/api/orders/order-1');
  });

  it('returns the order', async () => {
    mockGet.mockResolvedValue(mockOrder);
    const result = await ordersApi.get('order-1');
    expect(result.order_number).toBe('ORD-2026-001');
  });
});

describe('ordersApi.create', () => {
  it('calls POST /api/orders with data', async () => {
    mockPost.mockResolvedValue(mockOrder);
    const payload = { customer_id: 'cust-1', status: 'draft' as const, items: [] };
    await ordersApi.create(payload);
    expect(mockPost).toHaveBeenCalledWith('/api/orders', payload);
  });

  it('returns the created order', async () => {
    mockPost.mockResolvedValue(mockOrder);
    const result = await ordersApi.create({
      customer_id: 'cust-1',
      status: 'draft' as const,
      items: [],
    });
    expect(result.id).toBe('order-1');
  });
});

describe('ordersApi.update', () => {
  it('calls PUT /api/orders/:id with data', async () => {
    mockPut.mockResolvedValue(mockOrder);
    const update = { status: 'confirmed' as const };
    await ordersApi.update('order-1', update);
    expect(mockPut).toHaveBeenCalledWith('/api/orders/order-1', update);
  });
});

describe('ordersApi.delete', () => {
  it('calls DELETE /api/orders/:id', async () => {
    mockDelete.mockResolvedValue(undefined);
    await ordersApi.delete('order-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/orders/order-1');
  });
});

describe('ordersApi.updateStatus', () => {
  it('calls PUT /api/orders/:id/status with status payload', async () => {
    mockPut.mockResolvedValue(mockOrder);
    await ordersApi.updateStatus('order-1', 'shipped');
    expect(mockPut).toHaveBeenCalledWith('/api/orders/order-1/status', { status: 'shipped' });
  });
});

describe('ordersApi.getActivity', () => {
  it('calls GET /api/orders/:id/activity', async () => {
    mockGet.mockResolvedValue([]);
    await ordersApi.getActivity('order-1');
    expect(mockGet).toHaveBeenCalledWith('/api/orders/order-1/activity');
  });
});
