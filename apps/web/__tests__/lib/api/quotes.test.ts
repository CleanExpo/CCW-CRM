import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { quotesApi } from '@/lib/api/quotes';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);

beforeEach(() => vi.clearAllMocks());

const mockQuote = {
  id: 'quote-1',
  quote_number: 'Q-2026-001',
  customer_id: 'cust-1',
  status: 'draft' as const,
  total: '2500.00',
  quote_date: '2026-01-01',
  valid_until: '2026-02-01',
  items: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockPaginated = {
  items: [mockQuote],
  total: 1,
  page: 1,
  page_size: 50,
  total_pages: 1,
};

// ─── quotesApi.list ────────────────────────────────

describe('quotesApi.list', () => {
  it('calls GET /api/quotes with no params', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await quotesApi.list();
    expect(mockGet).toHaveBeenCalledWith('/api/quotes?');
  });

  it('appends page and page_size params', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await quotesApi.list({ page: 2, page_size: 25 });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('page=2'));
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('page_size=25'));
  });

  it('appends search param', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await quotesApi.list({ search: 'crane' });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('search=crane'));
  });

  it('appends status filter', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await quotesApi.list({ status: 'sent' });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('status=sent'));
  });

  it('appends customer_id filter', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await quotesApi.list({ customer_id: 'cust-99' });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('customer_id=cust-99'));
  });

  it('returns paginated quote response', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    const result = await quotesApi.list();
    expect(result.items[0].quote_number).toBe('Q-2026-001');
    expect(result.total).toBe(1);
  });
});

// ─── quotesApi.get ─────────────────────────────────

describe('quotesApi.get', () => {
  it('calls GET /api/quotes/:id', async () => {
    mockGet.mockResolvedValue(mockQuote);
    await quotesApi.get('quote-1');
    expect(mockGet).toHaveBeenCalledWith('/api/quotes/quote-1');
  });

  it('returns the quote', async () => {
    mockGet.mockResolvedValue(mockQuote);
    const result = await quotesApi.get('quote-1');
    expect(result.quote_number).toBe('Q-2026-001');
    expect(result.status).toBe('draft');
  });
});

// ─── quotesApi.create ──────────────────────────────

describe('quotesApi.create', () => {
  it('calls POST /api/quotes with data', async () => {
    mockPost.mockResolvedValue(mockQuote);
    const payload = { customer_id: 'cust-1', items: [] };
    await quotesApi.create(payload);
    expect(mockPost).toHaveBeenCalledWith('/api/quotes', payload);
  });

  it('returns created quote', async () => {
    mockPost.mockResolvedValue(mockQuote);
    const result = await quotesApi.create({ customer_id: 'cust-1', items: [] });
    expect(result.id).toBe('quote-1');
  });
});

// ─── quotesApi.update ──────────────────────────────

describe('quotesApi.update', () => {
  it('calls PUT /api/quotes/:id with update data', async () => {
    mockPut.mockResolvedValue(mockQuote);
    const update = { status: 'sent' as const };
    await quotesApi.update('quote-1', update);
    expect(mockPut).toHaveBeenCalledWith('/api/quotes/quote-1', update);
  });

  it('returns updated quote', async () => {
    mockPut.mockResolvedValue({ ...mockQuote, status: 'sent' as const });
    const result = await quotesApi.update('quote-1', { status: 'sent' });
    expect(result.status).toBe('sent');
  });
});

// ─── quotesApi.delete ──────────────────────────────

describe('quotesApi.delete', () => {
  it('calls DELETE /api/quotes/:id', async () => {
    mockDelete.mockResolvedValue(undefined);
    await quotesApi.delete('quote-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/quotes/quote-1');
  });
});

// ─── quotesApi.convertToOrder ──────────────────────

describe('quotesApi.convertToOrder', () => {
  it('calls POST /api/quotes/:id/convert-to-order', async () => {
    const mockConversion = { order_id: 'order-1', order_number: 'ORD-2026-001' };
    mockPost.mockResolvedValue(mockConversion);
    await quotesApi.convertToOrder('quote-1');
    expect(mockPost).toHaveBeenCalledWith('/api/quotes/quote-1/convert-to-order');
  });

  it('returns order_id and order_number', async () => {
    mockPost.mockResolvedValue({ order_id: 'order-1', order_number: 'ORD-2026-001' });
    const result = await quotesApi.convertToOrder('quote-1');
    expect(result.order_id).toBe('order-1');
    expect(result.order_number).toBe('ORD-2026-001');
  });
});

// ─── quotesApi.generate ────────────────────────────

describe('quotesApi.generate', () => {
  it('calls POST /api/quotes/generate with AI request', async () => {
    mockPost.mockResolvedValue(mockQuote);
    const payload = { customer_id: 'cust-1', requirements: 'Need 3 heavy excavators' };
    await quotesApi.generate(payload);
    expect(mockPost).toHaveBeenCalledWith('/api/quotes/generate', payload);
  });

  it('returns generated quote', async () => {
    mockPost.mockResolvedValue(mockQuote);
    const result = await quotesApi.generate({ customer_id: 'cust-1', requirements: 'Test' });
    expect(result.id).toBe('quote-1');
  });
});
