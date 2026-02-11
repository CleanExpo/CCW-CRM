import { apiClient } from "./client";
import {
  Invoice,
  InvoiceItem,
  InvoicePayment,
  CreateInvoiceData,
  CreatePaymentData,
  UpdateInvoiceData,
  PaginatedInvoiceResponse,
} from "@/app/(dashboard)/invoices/types";

/**
 * Invoice list params
 */
export interface InvoiceListParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: string;
  customer_id?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

/**
 * Invoices API client
 */
export const invoicesApi = {
  /**
   * List invoices with pagination and filters
   */
  async list(params: InvoiceListParams = {}): Promise<PaginatedInvoiceResponse> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.page_size) queryParams.append("page_size", params.page_size.toString());
    if (params.search) queryParams.append("search", params.search);
    if (params.status) queryParams.append("status", params.status);
    if (params.customer_id) queryParams.append("customer_id", params.customer_id);
    if (params.sort_by) queryParams.append("sort_by", params.sort_by);
    if (params.sort_order) queryParams.append("sort_order", params.sort_order);

    return apiClient.get<PaginatedInvoiceResponse>(`/api/invoices?${queryParams.toString()}`);
  },

  /**
   * Get a single invoice by ID
   */
  async get(id: string): Promise<Invoice> {
    return apiClient.get<Invoice>(`/api/invoices/${id}`);
  },

  /**
   * Create a new invoice
   */
  async create(data: CreateInvoiceData): Promise<Invoice> {
    return apiClient.post<Invoice>("/api/invoices", data);
  },

  /**
   * Update an existing invoice
   */
  async update(id: string, data: UpdateInvoiceData): Promise<Invoice> {
    return apiClient.put<Invoice>(`/api/invoices/${id}`, data);
  },

  /**
   * Delete an invoice
   */
  async delete(id: string): Promise<void> {
    return apiClient.delete(`/api/invoices/${id}`);
  },

  /**
   * Record a payment against an invoice
   */
  async recordPayment(invoiceId: string, data: CreatePaymentData): Promise<InvoicePayment> {
    return apiClient.post<InvoicePayment>(`/api/invoices/${invoiceId}/payments`, data);
  },

  /**
   * Get payments for an invoice
   */
  async getPayments(invoiceId: string): Promise<InvoicePayment[]> {
    return apiClient.get<InvoicePayment[]>(`/api/invoices/${invoiceId}/payments`);
  },

  /**
   * Send invoice to customer
   */
  async send(id: string): Promise<Invoice> {
    return apiClient.post<Invoice>(`/api/invoices/${id}/send`, {});
  },

  /**
   * Cancel an invoice
   */
  async cancel(id: string): Promise<Invoice> {
    return apiClient.post<Invoice>(`/api/invoices/${id}/cancel`, {});
  },
};
