/**
 * Document Extraction API Client
 *
 * Typed client for Claude Vision document extraction endpoints.
 * Supports both file upload and URL-based extraction for invoices and POs.
 */

import { apiClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────

export interface ExtractedLineItem {
  description?: string;
  quantity?: number;
  unit_price?: number;
  total?: number;
  [key: string]: unknown;
}

export interface ExtractedInvoiceData {
  vendor_name?: string;
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  total_amount?: number;
  tax_amount?: number;
  subtotal?: number;
  payment_terms?: string;
  line_items?: ExtractedLineItem[];
  [key: string]: unknown;
}

export interface ExtractedPOData {
  supplier_name?: string;
  po_number?: string;
  order_date?: string;
  delivery_date?: string;
  total_amount?: number;
  tax_amount?: number;
  line_items?: ExtractedLineItem[];
  [key: string]: unknown;
}

export interface ExtractionResponse<T = Record<string, unknown>> {
  document_type: string;
  confidence: number;
  extracted_data: T;
  warnings: string[];
}

export interface CreateFromExtractionResponse<T = Record<string, unknown>> {
  document_type: string;
  confidence: number;
  extracted_data: T;
  created_record_id: string | null;
  created_record_type: string | null;
  message: string;
}

// ─── API Client ───────────────────────────────────────────────────────────

export const documentsApi = {
  /**
   * Extract structured invoice data from an image URL.
   * Uses Claude Vision (or demo mock when ANTHROPIC_API_KEY is absent).
   */
  extractInvoiceFromUrl: (imageUrl: string) =>
    apiClient.post<ExtractionResponse<ExtractedInvoiceData>>('/api/documents/extract-from-url', {
      image_url: imageUrl,
      document_type: 'invoice',
    }),

  /**
   * Extract structured PO data from an image URL.
   */
  extractPOFromUrl: (imageUrl: string) =>
    apiClient.post<ExtractionResponse<ExtractedPOData>>('/api/documents/extract-from-url', {
      image_url: imageUrl,
      document_type: 'purchase_order',
    }),

  /**
   * Extract invoice data from URL AND create a draft invoice record.
   */
  createInvoiceFromUrl: (imageUrl: string) =>
    apiClient.post<CreateFromExtractionResponse<ExtractedInvoiceData>>(
      '/api/documents/create-from-url',
      { image_url: imageUrl, document_type: 'invoice' }
    ),

  /**
   * Extract PO data from URL AND create a draft purchase order record.
   */
  createPOFromUrl: (imageUrl: string) =>
    apiClient.post<CreateFromExtractionResponse<ExtractedPOData>>(
      '/api/documents/create-from-url',
      { image_url: imageUrl, document_type: 'purchase_order' }
    ),
};
