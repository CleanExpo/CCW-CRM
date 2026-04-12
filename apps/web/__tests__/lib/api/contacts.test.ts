import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { contactsApi } from '@/lib/api/contacts';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);

const mockContact = {
  id: 'contact-1',
  first_name: 'John',
  last_name: 'Doe',
  email: 'john@example.com',
  phone: '0400000000',
  is_primary: true,
  is_active: true,
  customer_id: 'cust-1',
  created_at: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('contactsApi.list', () => {
  it('calls GET /api/contacts with no params', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0 });
    await contactsApi.list();
    expect(mockGet).toHaveBeenCalledWith('/api/contacts');
  });

  it('appends search and customer_id filters', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0 });
    await contactsApi.list({ search: 'john', customer_id: 'cust-1' });
    const url = mockGet.mock.calls[0][0];
    expect(url).toContain('search=john');
    expect(url).toContain('customer_id=cust-1');
  });

  it('appends is_active filter', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0 });
    await contactsApi.list({ is_active: false });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('is_active=false'));
  });
});

describe('contactsApi.get', () => {
  it('calls GET /api/contacts/:id', async () => {
    mockGet.mockResolvedValue(mockContact);
    await contactsApi.get('contact-1');
    expect(mockGet).toHaveBeenCalledWith('/api/contacts/contact-1');
  });
});

describe('contactsApi.create', () => {
  it('calls POST /api/contacts', async () => {
    mockPost.mockResolvedValue(mockContact);
    const data = { first_name: 'John', last_name: 'Doe', email: 'john@example.com' };
    await contactsApi.create(data as never);
    expect(mockPost).toHaveBeenCalledWith('/api/contacts', data);
  });
});

describe('contactsApi.update', () => {
  it('calls PUT /api/contacts/:id', async () => {
    mockPut.mockResolvedValue(mockContact);
    await contactsApi.update('contact-1', { first_name: 'Jane' } as never);
    expect(mockPut).toHaveBeenCalledWith('/api/contacts/contact-1', { first_name: 'Jane' });
  });
});

describe('contactsApi.delete', () => {
  it('calls DELETE /api/contacts/:id', async () => {
    mockDelete.mockResolvedValue(undefined);
    await contactsApi.delete('contact-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/contacts/contact-1');
  });
});

describe('contactsApi.getCustomerContacts', () => {
  it('calls GET /api/contacts/customer/:customerId', async () => {
    mockGet.mockResolvedValue([mockContact]);
    await contactsApi.getCustomerContacts('cust-1');
    expect(mockGet).toHaveBeenCalledWith('/api/contacts/customer/cust-1');
  });

  it('includes inactive when requested', async () => {
    mockGet.mockResolvedValue([]);
    await contactsApi.getCustomerContacts('cust-1', true);
    expect(mockGet).toHaveBeenCalledWith('/api/contacts/customer/cust-1?include_inactive=true');
  });
});

describe('contactsApi.setPrimary', () => {
  it('calls POST /api/contacts/:id/set-primary', async () => {
    mockPost.mockResolvedValue(mockContact);
    await contactsApi.setPrimary('contact-1');
    expect(mockPost).toHaveBeenCalledWith('/api/contacts/contact-1/set-primary', {});
  });
});
