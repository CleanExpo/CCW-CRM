/**
 * Cin7 Sales Order Fulfilment API client.
 *
 * Typed client for the pick -> pack -> ship -> invoice -> payment workflow.
 */

import { apiClient } from './client';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type FulfilmentStatus =
  | 'pending'
  | 'picking'
  | 'packing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

// ---------------------------------------------------------------------------
// Fulfilment interfaces
// ---------------------------------------------------------------------------

export interface Cin7Fulfilment {
  id: string;
  cin7_order_mapping_id: string;
  cin7_fulfilment_id: string | null;
  status: FulfilmentStatus;
  pick_location: string | null;
  tracking_number: string | null;
  carrier: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** Human-readable order reference (e.g. ORD-2024-001), populated when available */
  order_reference: string | null;
}

export interface FulfilmentListResponse {
  items: Cin7Fulfilment[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CreateFulfilmentRequest {
  cin7_order_mapping_id: string;
  pick_location?: string | null;
  notes?: string | null;
}

export interface UpdateFulfilmentStatusRequest {
  status: FulfilmentStatus;
  tracking_number?: string | null;
  carrier?: string | null;
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// Invoice interfaces
// ---------------------------------------------------------------------------

export interface Cin7Invoice {
  id: string;
  cin7_order_mapping_id: string;
  cin7_invoice_id: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  /** Amount as a numeric string to preserve decimal precision */
  amount: string;
  currency: string;
  status: InvoiceStatus;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  order_reference: string | null;
}

export interface InvoiceListResponse {
  items: Cin7Invoice[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface MarkInvoicePaidRequest {
  amount: number;
  paid_at?: string | null;
  payment_method?: string | null;
  /** Required for offline mark-paid (EFT/cash/cheque audit trail). */
  reference?: string | null;
}

export interface InvoiceSyncResponse {
  synced: number;
  message: string;
}

// ---------------------------------------------------------------------------
// Payment interfaces
// ---------------------------------------------------------------------------

export interface Cin7Payment {
  id: string;
  cin7_invoice_id: string | null;
  cin7_payment_id: string | null;
  payment_method: string | null;
  /** Amount as a numeric string */
  amount: string;
  currency: string;
  payment_date: string | null;
  reference: string | null;
  status: PaymentStatus;
  created_at: string;
}

export interface PaymentListResponse {
  items: Cin7Payment[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const cin7FulfilmentApi = {
  // --- Fulfilments ---

  listFulfilments: (
    page = 1,
    pageSize = 20,
    status?: FulfilmentStatus
  ): Promise<FulfilmentListResponse> => {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    });
    if (status) params.set('status', status);
    return apiClient.get(`/api/cin7/fulfilments?${params.toString()}`);
  },

  createFulfilment: (data: CreateFulfilmentRequest): Promise<Cin7Fulfilment> =>
    apiClient.post('/api/cin7/fulfilments', data),

  updateFulfilmentStatus: (
    id: string,
    data: UpdateFulfilmentStatusRequest
  ): Promise<Cin7Fulfilment> => apiClient.patch(`/api/cin7/fulfilments/${id}/status`, data),

  // --- Invoices ---

  listInvoices: (page = 1, pageSize = 20, status?: InvoiceStatus): Promise<InvoiceListResponse> => {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    });
    if (status) params.set('status', status);
    return apiClient.get(`/api/cin7/invoices?${params.toString()}`);
  },

  syncInvoices: (): Promise<InvoiceSyncResponse> => apiClient.post('/api/cin7/invoices/sync', {}),

  markInvoicePaid: (id: string, data: MarkInvoicePaidRequest): Promise<Cin7Invoice> =>
    apiClient.patch(`/api/cin7/invoices/${id}/mark-paid`, data),

  // --- Payments ---

  listPayments: (page = 1, pageSize = 20): Promise<PaymentListResponse> => {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    });
    return apiClient.get(`/api/cin7/payments?${params.toString()}`);
  },
};
