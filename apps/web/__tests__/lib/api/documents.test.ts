import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

import { documentsApi } from '@/lib/api/documents';
import { apiClient } from '@/lib/api/client';

const mockPost = vi.mocked(apiClient.post);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('documentsApi.extractInvoiceFromUrl', () => {
  it('posts to extract-from-url with invoice document_type', async () => {
    mockPost.mockResolvedValue({
      document_type: 'invoice',
      confidence: 0.95,
      extracted_data: { vendor_name: 'ACME' },
      warnings: [],
    });
    const result = await documentsApi.extractInvoiceFromUrl('https://example.com/invoice.jpg');
    expect(mockPost).toHaveBeenCalledWith('/api/documents/extract-from-url', {
      image_url: 'https://example.com/invoice.jpg',
      document_type: 'invoice',
    });
    expect(result.document_type).toBe('invoice');
    expect(result.confidence).toBe(0.95);
  });
});

describe('documentsApi.extractPOFromUrl', () => {
  it('posts to extract-from-url with purchase_order document_type', async () => {
    mockPost.mockResolvedValue({
      document_type: 'purchase_order',
      confidence: 0.88,
      extracted_data: { supplier_name: 'Supplier Co' },
      warnings: [],
    });
    await documentsApi.extractPOFromUrl('https://example.com/po.jpg');
    expect(mockPost).toHaveBeenCalledWith('/api/documents/extract-from-url', {
      image_url: 'https://example.com/po.jpg',
      document_type: 'purchase_order',
    });
  });
});

describe('documentsApi.createInvoiceFromUrl', () => {
  it('posts to create-from-url with invoice type and returns created record info', async () => {
    mockPost.mockResolvedValue({
      document_type: 'invoice',
      confidence: 0.92,
      extracted_data: {},
      created_record_id: 'inv-123',
      created_record_type: 'invoice',
      message: 'Invoice created',
    });
    const result = await documentsApi.createInvoiceFromUrl('https://example.com/inv.jpg');
    expect(mockPost).toHaveBeenCalledWith('/api/documents/create-from-url', {
      image_url: 'https://example.com/inv.jpg',
      document_type: 'invoice',
    });
    expect(result.created_record_id).toBe('inv-123');
  });
});

describe('documentsApi.createPOFromUrl', () => {
  it('posts to create-from-url with purchase_order type', async () => {
    mockPost.mockResolvedValue({
      document_type: 'purchase_order',
      confidence: 0.85,
      extracted_data: {},
      created_record_id: 'po-456',
      created_record_type: 'purchase_order',
      message: 'PO created',
    });
    const result = await documentsApi.createPOFromUrl('https://example.com/po.jpg');
    expect(mockPost).toHaveBeenCalledWith('/api/documents/create-from-url', {
      image_url: 'https://example.com/po.jpg',
      document_type: 'purchase_order',
    });
    expect(result.created_record_id).toBe('po-456');
  });
});
