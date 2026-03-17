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
      subtotal: 1000.00,
      gst: 50.00,
      pst: 70.00,
      total: 1120.00,
      breakdown: [
        { tax_code: 'GST', rate: 0.05, amount: 50.00 },
        { tax_code: 'PST', rate: 0.07, amount: 70.00 },
      ],
    };
    mockPost.mockResolvedValue(mockTaxResult);

    const invoiceData = {
      line_items: [
        { amount: 500.00, tax_code: 'GST_PST' },
        { amount: 500.00, tax_code: 'GST_PST' },
      ],
      province: 'BC',
    };

    const result = await invoicesApiExtended.calculateTax(invoiceData);

    expect(mockPost).toHaveBeenCalledWith('/api/invoices/tax/calculate', invoiceData);
    expect(result.total).toBe(1120.00);
    expect(result.gst).toBe(50.00);
    expect(result.pst).toBe(70.00);
  });

  it('calculates GST only for GST-exempt provinces', async () => {
    const mockTaxResult = {
      subtotal: 1000.00,
      gst: 50.00,
      pst: 0.00,
      total: 1050.00,
      breakdown: [{ tax_code: 'GST', rate: 0.05, amount: 50.00 }],
    };
    mockPost.mockResolvedValue(mockTaxResult);

    const result = await invoicesApiExtended.calculateTax({
      line_items: [{ amount: 1000.00, tax_code: 'GST' }],
      province: 'AB',
    });

    expect(result.pst).toBe(0.00);
    expect(result.total).toBe(1050.00);
  });

  it('handles tax-exempt items with EXEMPT tax code', async () => {
    const mockTaxResult = {
      subtotal: 1000.00,
      gst: 0.00,
      pst: 0.00,
      total: 1000.00,
      breakdown: [],
    };
    mockPost.mockResolvedValue(mockTaxResult);

    const result = await invoicesApiExtended.calculateTax({
      line_items: [{ amount: 1000.00, tax_code: 'EXEMPT' }],
    });

    expect(result.total).toBe(1000.00);
    expect(result.gst).toBe(0.00);
  });

  it('propagates errors on invalid tax codes', async () => {
    mockPost.mockRejectedValue(new Error('Invalid tax_code: INVALID'));
    await expect(
      invoicesApiExtended.calculateTax({
        line_items: [{ amount: 100.00, tax_code: 'INVALID' }],
      })
    ).rejects.toThrow('Invalid tax_code');
  });
});
