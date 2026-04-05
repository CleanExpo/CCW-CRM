import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { customersApi } from '@/lib/api/customers';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);

const mockCustomer = {
  id: 'cust-1',
  customer_number: 'C-001',
  company_name: 'Acme Corp',
  contact_name: 'John Doe',
  email: 'john@acme.com',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockPaginated = {
  items: [mockCustomer],
  total: 1,
  page: 1,
  page_size: 50,
  total_pages: 1,
};

beforeEach(() => vi.clearAllMocks());

describe('customersApi.list', () => {
  it('calls GET /api/customers with no params', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await customersApi.list();
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/customers'));
  });

  it('appends search to query string', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await customersApi.list({ search: 'acme' });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('search=acme'));
  });

  it('appends page param', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await customersApi.list({ page: 3 });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('page=3'));
  });

  it('returns paginated response', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    const result = await customersApi.list();
    expect(result.total).toBe(1);
    expect(result.items[0].company_name).toBe('Acme Corp');
  });
});

describe('customersApi.get', () => {
  it('calls GET /api/customers/:id', async () => {
    mockGet.mockResolvedValue(mockCustomer);
    await customersApi.get('cust-1');
    expect(mockGet).toHaveBeenCalledWith('/api/customers/cust-1');
  });
});

describe('customersApi.create', () => {
  it('calls POST /api/customers', async () => {
    mockPost.mockResolvedValue(mockCustomer);
    const data = { company_name: 'Acme Corp', contact_name: 'John', email: 'j@acme.com' };
    await customersApi.create(data);
    expect(mockPost).toHaveBeenCalledWith('/api/customers', data);
  });

  it('returns the created customer', async () => {
    mockPost.mockResolvedValue(mockCustomer);
    const result = await customersApi.create({
      company_name: 'X',
      contact_name: 'Y',
      email: 'y@x.com',
    });
    expect(result.id).toBe('cust-1');
  });
});

describe('customersApi.update', () => {
  it('calls PUT /api/customers/:id', async () => {
    mockPut.mockResolvedValue(mockCustomer);
    await customersApi.update('cust-1', { company_name: 'Updated' });
    expect(mockPut).toHaveBeenCalledWith('/api/customers/cust-1', { company_name: 'Updated' });
  });
});

describe('customersApi.delete', () => {
  it('calls DELETE /api/customers/:id', async () => {
    mockDelete.mockResolvedValue(undefined);
    await customersApi.delete('cust-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/customers/cust-1');
  });
});
