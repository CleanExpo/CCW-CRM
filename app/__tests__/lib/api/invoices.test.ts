import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { invoicesApi } from '@/lib/api/invoices';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);

const mockInvoice = {
  id: 'inv-1',
  invoice_number: 'INV-2026-0001',
  customer_id: 'cust-1',
  status: 'draft',
  total: 1500,
  created_at: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('invoicesApi.list', () => {
  it('calls GET /api/invoices with no params', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0 });
    await invoicesApi.list();
    expect(mockGet).toHaveBeenCalledWith('/api/invoices');
  });

  it('appends query params when provided', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0 });
    await invoicesApi.list({ page: 2, status: 'sent' as never, overdue_only: true });
    const url = mockGet.mock.calls[0][0];
    expect(url).toContain('page=2');
    expect(url).toContain('status=sent');
    expect(url).toContain('overdue_only=true');
  });
});

describe('invoicesApi.get', () => {
  it('calls GET /api/invoices/:id', async () => {
    mockGet.mockResolvedValue(mockInvoice);
    await invoicesApi.get('inv-1');
    expect(mockGet).toHaveBeenCalledWith('/api/invoices/inv-1');
  });
});

describe('invoicesApi.create', () => {
  it('calls POST /api/invoices', async () => {
    mockPost.mockResolvedValue(mockInvoice);
    const data = { customer_id: 'cust-1', items: [] };
    await invoicesApi.create(data as never);
    expect(mockPost).toHaveBeenCalledWith('/api/invoices', data);
  });
});

describe('invoicesApi.update', () => {
  it('calls PUT /api/invoices/:id', async () => {
    mockPut.mockResolvedValue(mockInvoice);
    await invoicesApi.update('inv-1', { status: 'sent' } as never);
    expect(mockPut).toHaveBeenCalledWith('/api/invoices/inv-1', { status: 'sent' });
  });
});

describe('invoicesApi.delete', () => {
  it('calls DELETE /api/invoices/:id', async () => {
    mockDelete.mockResolvedValue(undefined);
    await invoicesApi.delete('inv-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/invoices/inv-1');
  });
});

describe('invoicesApi.send', () => {
  it('calls POST /api/invoices/:id/send', async () => {
    mockPost.mockResolvedValue({ ...mockInvoice, status: 'sent' });
    await invoicesApi.send('inv-1');
    expect(mockPost).toHaveBeenCalledWith('/api/invoices/inv-1/send', {});
  });
});

describe('invoicesApi.cancel', () => {
  it('calls POST /api/invoices/:id/cancel', async () => {
    mockPost.mockResolvedValue({ ...mockInvoice, status: 'cancelled' });
    await invoicesApi.cancel('inv-1');
    expect(mockPost).toHaveBeenCalledWith('/api/invoices/inv-1/cancel', {});
  });
});

describe('invoicesApi.recordPayment', () => {
  it('calls POST /api/invoices/:id/payments', async () => {
    mockPost.mockResolvedValue(mockInvoice);
    const payment = { amount: 500, payment_method: 'bank_transfer', payment_date: '2026-01-15' };
    await invoicesApi.recordPayment('inv-1', payment as never);
    expect(mockPost).toHaveBeenCalledWith('/api/invoices/inv-1/payments', payment);
  });
});

describe('invoicesApi.getPayments', () => {
  it('calls GET /api/invoices/:id/payments', async () => {
    mockGet.mockResolvedValue([]);
    await invoicesApi.getPayments('inv-1');
    expect(mockGet).toHaveBeenCalledWith('/api/invoices/inv-1/payments');
  });
});

describe('invoicesApi.deletePayment', () => {
  it('calls DELETE /api/invoices/payments/:id', async () => {
    mockDelete.mockResolvedValue(undefined);
    await invoicesApi.deletePayment('pay-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/invoices/payments/pay-1');
  });
});

describe('invoicesApi.getRevenueSummary', () => {
  it('calls GET /api/invoices/reports/revenue', async () => {
    mockGet.mockResolvedValue({ total_revenue: 50000 });
    await invoicesApi.getRevenueSummary();
    expect(mockGet).toHaveBeenCalledWith('/api/invoices/reports/revenue');
  });
});

describe('invoicesApi.getTaxSummary', () => {
  it('calls GET /api/invoices/reports/tax', async () => {
    mockGet.mockResolvedValue({ total_tax: 5000 });
    await invoicesApi.getTaxSummary();
    expect(mockGet).toHaveBeenCalledWith('/api/invoices/reports/tax');
  });
});

describe('invoicesApi.generateFromOrder', () => {
  it('calls POST /api/invoices/from-order/:orderId', async () => {
    mockPost.mockResolvedValue(mockInvoice);
    await invoicesApi.generateFromOrder('order-1');
    expect(mockPost).toHaveBeenCalledWith('/api/invoices/from-order/order-1', {});
  });
});
