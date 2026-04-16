/**
 * Invoices API Client Extended Tests
 *
 * Tests for tax calculation endpoint (Phase 2 - Batch 2D)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

import { apiClient } from '@/lib/api/client';

// Extended invoices API methods (Phase 2 additions)
const invoicesApiExtended = {
  async calculateTax(invoiceData: {
    line_items: Array<{ amount: number; tax_code: string }>;
    province?: string;
  }) {
    return apiClient.post('/api/invoices/tax/calculate', invoiceData);
  },
};

const mockPost = vi.mocked(apiClient.post);

beforeEach(() => vi.clearAllMocks());

// ─── Tax Calculation ────────────────────────────────────────────────

describe('invoicesApiExtended.calculateTax', () => {
  it('calls POST /api/invoices/tax/calculate with line items', async () => {
    const mockTaxResult = {
      subtotal: 1000.0,
      gst: 50.0,
      pst: 70.0,
      total: 1120.0,
      breakdown: [
        { tax_code: 'GST', rate: 0.05, amount: 50.0 },
        { tax_code: 'PST', rate: 0.07, amount: 70.0 },
      ],
    };
    mockPost.mockResolvedValue(mockTaxResult);

    const invoiceData = {
      line_items: [
        { amount: 500.0, tax_code: 'GST_PST' },
        { amount: 500.0, tax_code: 'GST_PST' },
      ],
      province: 'BC',
    };

    const result = await invoicesApiExtended.calculateTax(invoiceData);

    expect(mockPost).toHaveBeenCalledWith('/api/invoices/tax/calculate', invoiceData);
    expect((result as any).total).toBe(1120.0);
    expect((result as any).gst).toBe(50.0);
    expect((result as any).pst).toBe(70.0);
  });

  it('calculates GST only for GST-exempt provinces', async () => {
    const mockTaxResult = {
      subtotal: 1000.0,
      gst: 50.0,
      pst: 0.0,
      total: 1050.0,
      breakdown: [{ tax_code: 'GST', rate: 0.05, amount: 50.0 }],
    };
    mockPost.mockResolvedValue(mockTaxResult);

    const result = await invoicesApiExtended.calculateTax({
      line_items: [{ amount: 1000.0, tax_code: 'GST' }],
      province: 'AB',
    });

    expect((result as any).pst).toBe(0.0);
    expect((result as any).total).toBe(1050.0);
  });

  it('handles tax-exempt items with EXEMPT tax code', async () => {
    const mockTaxResult = {
      subtotal: 1000.0,
      gst: 0.0,
      pst: 0.0,
      total: 1000.0,
      breakdown: [],
    };
    mockPost.mockResolvedValue(mockTaxResult);

    const result = await invoicesApiExtended.calculateTax({
      line_items: [{ amount: 1000.0, tax_code: 'EXEMPT' }],
    });

    expect((result as any).total).toBe(1000.0);
    expect((result as any).gst).toBe(0.0);
  });

  it('propagates errors on invalid tax codes', async () => {
    mockPost.mockRejectedValue(new Error('Invalid tax_code: INVALID'));
    await expect(
      invoicesApiExtended.calculateTax({
        line_items: [{ amount: 100.0, tax_code: 'INVALID' }],
      })
    ).rejects.toThrow('Invalid tax_code');
  });
});
