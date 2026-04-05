import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { suppliersApi } from '@/lib/api/suppliers';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);

beforeEach(() => vi.clearAllMocks());

const mockSupplier = {
  id: 'sup-1',
  supplier_code: 'SUP-001',
  company_name: 'Acme Tools Ltd',
  country: 'AU',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockPaginated = {
  items: [mockSupplier],
  total: 1,
  page: 1,
  page_size: 50,
  total_pages: 1,
};

// ─── suppliersApi.list ─────────────────────────────

describe('suppliersApi.list', () => {
  it('calls GET /api/suppliers with no params', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await suppliersApi.list();
    expect(mockGet).toHaveBeenCalledWith('/api/suppliers?');
  });

  it('appends search param', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await suppliersApi.list({ search: 'acme' });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('search=acme'));
  });

  it('appends is_active filter', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await suppliersApi.list({ is_active: true });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('is_active=true'));
  });

  it('appends sort params', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await suppliersApi.list({ sort_by: 'company_name', sort_order: 'asc' });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('sort_by=company_name'));
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('sort_order=asc'));
  });

  it('returns paginated supplier response', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    const result = await suppliersApi.list();
    expect(result.items[0].company_name).toBe('Acme Tools Ltd');
    expect(result.total).toBe(1);
  });
});

// ─── suppliersApi.get ──────────────────────────────

describe('suppliersApi.get', () => {
  it('calls GET /api/suppliers/:id', async () => {
    mockGet.mockResolvedValue(mockSupplier);
    await suppliersApi.get('sup-1');
    expect(mockGet).toHaveBeenCalledWith('/api/suppliers/sup-1');
  });

  it('returns the supplier', async () => {
    mockGet.mockResolvedValue(mockSupplier);
    const result = await suppliersApi.get('sup-1');
    expect(result.supplier_code).toBe('SUP-001');
    expect(result.is_active).toBe(true);
  });
});

// ─── suppliersApi.create ───────────────────────────

describe('suppliersApi.create', () => {
  it('calls POST /api/suppliers with data', async () => {
    mockPost.mockResolvedValue(mockSupplier);
    const payload = { supplier_code: 'SUP-002', company_name: 'New Supplier' };
    await suppliersApi.create(payload);
    expect(mockPost).toHaveBeenCalledWith('/api/suppliers', payload);
  });

  it('returns created supplier', async () => {
    mockPost.mockResolvedValue(mockSupplier);
    const result = await suppliersApi.create({
      supplier_code: 'SUP-001',
      company_name: 'Acme Tools Ltd',
    });
    expect(result.id).toBe('sup-1');
  });
});

// ─── suppliersApi.update ───────────────────────────

describe('suppliersApi.update', () => {
  it('calls PUT /api/suppliers/:id with update data', async () => {
    mockPut.mockResolvedValue(mockSupplier);
    const update = { contact_name: 'Jane Smith', email: 'jane@acme.com' };
    await suppliersApi.update('sup-1', update);
    expect(mockPut).toHaveBeenCalledWith('/api/suppliers/sup-1', update);
  });

  it('can deactivate supplier via is_active: false', async () => {
    mockPut.mockResolvedValue({ ...mockSupplier, is_active: false });
    await suppliersApi.update('sup-1', { is_active: false });
    expect(mockPut).toHaveBeenCalledWith('/api/suppliers/sup-1', { is_active: false });
  });
});

// ─── suppliersApi.delete ───────────────────────────

describe('suppliersApi.delete', () => {
  it('calls DELETE /api/suppliers/:id', async () => {
    mockDelete.mockResolvedValue(undefined);
    await suppliersApi.delete('sup-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/suppliers/sup-1');
  });
});
