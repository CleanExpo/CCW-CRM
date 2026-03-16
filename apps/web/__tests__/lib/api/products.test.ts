import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { productsApi } from '@/lib/api/products';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);

const mockProduct = {
  id: 'prod-1',
  sku: 'SKU-001',
  name: 'Test Product',
  price: '99.99',
  cost: '50.00',
  stock: 10,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockPaginated = {
  items: [mockProduct],
  total: 1,
  page: 1,
  page_size: 50,
  total_pages: 1,
};

beforeEach(() => vi.clearAllMocks());

describe('productsApi.list', () => {
  it('calls GET /api/products', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await productsApi.list();
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/products'));
  });

  it('appends category filter', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await productsApi.list({ category: 'hand_tools' });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('category=hand_tools'));
  });

  it('appends is_active filter', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await productsApi.list({ is_active: false });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('is_active=false'));
  });

  it('returns paginated products', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    const result = await productsApi.list();
    expect(result.items[0].sku).toBe('SKU-001');
  });
});

describe('productsApi.get', () => {
  it('calls GET /api/products/:id', async () => {
    mockGet.mockResolvedValue(mockProduct);
    await productsApi.get('prod-1');
    expect(mockGet).toHaveBeenCalledWith('/api/products/prod-1');
  });
});

describe('productsApi.create', () => {
  it('calls POST /api/products', async () => {
    mockPost.mockResolvedValue(mockProduct);
    const data = { sku: 'SKU-001', name: 'Test', price: '99.99', cost: '50.00', stock: 5 };
    await productsApi.create(data);
    expect(mockPost).toHaveBeenCalledWith('/api/products', data);
  });
});

describe('productsApi.update', () => {
  it('calls PUT /api/products/:id', async () => {
    mockPut.mockResolvedValue(mockProduct);
    await productsApi.update('prod-1', { name: 'Updated' });
    expect(mockPut).toHaveBeenCalledWith('/api/products/prod-1', { name: 'Updated' });
  });
});

describe('productsApi.delete', () => {
  it('calls DELETE /api/products/:id', async () => {
    mockDelete.mockResolvedValue(undefined);
    await productsApi.delete('prod-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/products/prod-1');
  });
});
