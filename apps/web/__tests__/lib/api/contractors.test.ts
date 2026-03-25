import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useEffect: vi.fn(), useState: vi.fn(() => [null, vi.fn()]) };
});

import { contractorAPI } from '@/lib/api/contractors';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPatch = vi.mocked(apiClient.patch);
const mockDelete = vi.mocked(apiClient.delete);

const mockContractor = {
  id: 'ctr-1',
  full_name: 'Bob Smith',
  email: 'bob@example.com',
  phone: '0412345678',
  state: 'QLD',
  suburb: 'Brisbane',
  specialisation: 'carpet_cleaning',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('contractorAPI.list', () => {
  it('calls GET /api/contractors/ with no params', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0 });
    await contractorAPI.list();
    expect(mockGet).toHaveBeenCalledWith('/api/contractors/?');
  });

  it('appends page and pageSize params', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0 });
    await contractorAPI.list({ page: 2, pageSize: 25 });
    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toContain('page=2');
    expect(url).toContain('page_size=25');
  });

  it('appends state filter', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0 });
    await contractorAPI.list({ state: 'QLD' });
    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toContain('state=QLD');
  });

  it('appends specialisation filter', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0 });
    await contractorAPI.list({ specialisation: 'carpet_cleaning' });
    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toContain('specialisation=carpet_cleaning');
  });

  it('returns the response data', async () => {
    const response = { items: [mockContractor], total: 1 };
    mockGet.mockResolvedValue(response);
    const result = await contractorAPI.list();
    expect(result).toEqual(response);
  });
});

describe('contractorAPI.get', () => {
  it('calls GET /api/contractors/:id', async () => {
    mockGet.mockResolvedValue(mockContractor);
    await contractorAPI.get('ctr-1');
    expect(mockGet).toHaveBeenCalledWith('/api/contractors/ctr-1');
  });

  it('returns the contractor', async () => {
    mockGet.mockResolvedValue(mockContractor);
    const result = await contractorAPI.get('ctr-1');
    expect(result).toEqual(mockContractor);
  });
});

describe('contractorAPI.create', () => {
  it('calls POST /api/contractors/', async () => {
    mockPost.mockResolvedValue(mockContractor);
    const createData = { full_name: 'Bob Smith', email: 'bob@example.com', state: 'QLD' };
    await contractorAPI.create(createData as any);
    expect(mockPost).toHaveBeenCalledWith('/api/contractors/', createData);
  });
});

describe('contractorAPI.update', () => {
  it('calls PATCH /api/contractors/:id with update data', async () => {
    mockPatch.mockResolvedValue({ ...mockContractor, phone: '0499999999' });
    await contractorAPI.update('ctr-1', { phone: '0499999999' } as any);
    expect(mockPatch).toHaveBeenCalledWith('/api/contractors/ctr-1', { phone: '0499999999' });
  });
});

describe('contractorAPI.delete', () => {
  it('calls DELETE /api/contractors/:id', async () => {
    mockDelete.mockResolvedValue(undefined);
    await contractorAPI.delete('ctr-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/contractors/ctr-1');
  });
});

describe('contractorAPI.addAvailability', () => {
  it('calls POST /api/contractors/:id/availability', async () => {
    const slot = { start_time: '2026-01-15T09:00:00Z', end_time: '2026-01-15T17:00:00Z' };
    mockPost.mockResolvedValue({ id: 'slot-1', ...slot });
    await contractorAPI.addAvailability('ctr-1', slot as any);
    expect(mockPost).toHaveBeenCalledWith('/api/contractors/ctr-1/availability', slot);
  });
});

describe('contractorAPI.getAvailability', () => {
  it('calls GET /api/contractors/:id/availability without status', async () => {
    mockGet.mockResolvedValue([]);
    await contractorAPI.getAvailability('ctr-1');
    expect(mockGet).toHaveBeenCalledWith('/api/contractors/ctr-1/availability');
  });

  it('appends status query param when provided', async () => {
    mockGet.mockResolvedValue([]);
    await contractorAPI.getAvailability('ctr-1', 'available' as any);
    expect(mockGet).toHaveBeenCalledWith('/api/contractors/ctr-1/availability?status=available');
  });
});

describe('contractorAPI.searchByLocation', () => {
  it('calls GET /api/contractors/search/by-location with suburb', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0 });
    await contractorAPI.searchByLocation({ suburb: 'Fortitude Valley' });
    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toContain('/api/contractors/search/by-location');
    expect(url).toContain('suburb=Fortitude+Valley');
  });

  it('appends state when provided', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0 });
    await contractorAPI.searchByLocation({ suburb: 'Newstead', state: 'QLD' });
    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toContain('state=QLD');
  });
});
