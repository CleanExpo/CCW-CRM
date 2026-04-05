import { apiClient } from './client';
import type {
  Invoice,
  InvoicePayment,
  PaginatedInvoicesResponse,
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  RecordPaymentRequest,
  InvoiceStatus,
  RevenueSummary,
  TaxSummary,
} from '@/types/invoices';

/**
 * Invoices API client
 * Backend routes: apps/backend/src/api/routes/invoices.py, invoice_payments.py
 */
export const invoicesApi = {
  /**
   * List invoices with pagination and filters
   * GET /api/invoices
   */
  async list(params?: {
    page?: number;
    page_size?: number;
    search?: string;
    status?: InvoiceStatus;
    customer_id?: string;
    date_from?: string;
    date_to?: string;
    overdue_only?: boolean;
  }): Promise<PaginatedInvoicesResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.customer_id) queryParams.append('customer_id', params.customer_id);
    if (params?.date_from) queryParams.append('date_from', params.date_from);
    if (params?.date_to) queryParams.append('date_to', params.date_to);
    if (params?.overdue_only) queryParams.append('overdue_only', params.overdue_only.toString());

    const url = `/api/invoices${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiClient.get<PaginatedInvoicesResponse>(url);
  },

  /**
   * Get a single invoice by ID with items and payments
   * GET /api/invoices/{invoice_id}
   */
  async get(id: string): Promise<Invoice> {
    return apiClient.get<Invoice>(`/api/invoices/${id}`);
  },

  /**
   * Create a new invoice
   * POST /api/invoices
   * Returns invoice with auto-generated invoice_number (INV-YYYY-NNNN)
   */
  async create(data: CreateInvoiceRequest): Promise<Invoice> {
    return apiClient.post<Invoice>('/api/invoices', data);
  },

  /**
   * Update an existing invoice (draft only)
   * PUT /api/invoices/{invoice_id}
   */
  async update(id: string, data: UpdateInvoiceRequest): Promise<Invoice> {
    return apiClient.put<Invoice>(`/api/invoices/${id}`, data);
  },

  /**
   * Delete an invoice (draft only)
   * DELETE /api/invoices/{invoice_id}
   */
  async delete(id: string): Promise<void> {
    return apiClient.delete(`/api/invoices/${id}`);
  },

  /**
   * Mark invoice as sent
   * POST /api/invoices/{invoice_id}/send
   * Changes status from 'draft' to 'sent'
   */
  async send(id: string): Promise<Invoice> {
    return apiClient.post<Invoice>(`/api/invoices/${id}/send`, {});
  },

  /**
   * Cancel an invoice
   * POST /api/invoices/{invoice_id}/cancel
   */
  async cancel(id: string): Promise<Invoice> {
    return apiClient.post<Invoice>(`/api/invoices/${id}/cancel`, {});
  },

  /**
   * Record a payment against an invoice
   * POST /api/invoices/{invoice_id}/payments
   * Backend automatically updates amount_paid, amount_due, and status
   */
  async recordPayment(invoiceId: string, data: RecordPaymentRequest): Promise<Invoice> {
    return apiClient.post<Invoice>(`/api/invoices/${invoiceId}/payments`, data);
  },

  /**
   * Get all payments for an invoice
   * GET /api/invoices/{invoice_id}/payments
   */
  async getPayments(invoiceId: string): Promise<InvoicePayment[]> {
    return apiClient.get<InvoicePayment[]>(`/api/invoices/${invoiceId}/payments`);
  },

  /**
   * Delete a payment record
   * DELETE /api/invoices/payments/{payment_id}
   * Backend recalculates amount_paid, amount_due, and status
   */
  async deletePayment(paymentId: string): Promise<void> {
    return apiClient.delete(`/api/invoices/payments/${paymentId}`);
  },

  /**
   * Get revenue summary for financial dashboard
   * GET /api/invoices/reports/revenue
   */
  async getRevenueSummary(): Promise<RevenueSummary> {
    return apiClient.get<RevenueSummary>('/api/invoices/reports/revenue');
  },

  /**
   * Get tax summary report
   * GET /api/invoices/reports/tax
   */
  async getTaxSummary(): Promise<TaxSummary> {
    return apiClient.get<TaxSummary>('/api/invoices/reports/tax');
  },

  /**
   * Generate an invoice from a confirmed or delivered order
   * POST /api/invoices/from-order/{orderId}
   * Returns the newly created draft invoice
   */
  async generateFromOrder(orderId: string): Promise<Invoice> {
    return apiClient.post<Invoice>(`/api/invoices/from-order/${orderId}`, {});
  },
};
