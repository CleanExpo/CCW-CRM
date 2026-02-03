import { apiClient } from "./client";

/**
 * Quote status enum matching backend
 */
export type QuoteStatus =
  | "draft"
  | "pending"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired";

/**
 * Quote item interface
 */
export interface QuoteItem {
  id: string;
  quote_id: string;
  product_id: string;
  quantity: number;
  unit_price: string;
  line_total: string;
  created_at?: string;
}

/**
 * Quote interface
 */
export interface Quote {
  id: string;
  quote_number: string;
  customer_id: string;
  customer_name?: string;
  status: QuoteStatus;
  total: string;
  quote_date: string;
  valid_until: string;
  notes?: string;
  items: QuoteItem[];
  created_at: string;
  updated_at: string;
}

/**
 * Quote create request
 */
export interface QuoteCreate {
  customer_id: string;
  status?: QuoteStatus;
  quote_date?: string;
  valid_until?: string;
  notes?: string;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_price: string;
  }>;
}

/**
 * Quote update request
 */
export interface QuoteUpdate {
  customer_id?: string;
  status?: QuoteStatus;
  valid_until?: string;
  notes?: string;
  items?: Array<{
    id?: string;
    product_id: string;
    quantity: number;
    unit_price: string;
  }>;
}

/**
 * Quote list params
 */
export interface QuoteListParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: QuoteStatus;
  customer_id?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

/**
 * Paginated quote response
 */
export interface PaginatedQuotes {
  items: Quote[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * AI quote generation request
 */
export interface GenerateQuoteRequest {
  customer_id: string;
  requirements: string;
  context?: Record<string, any>;
}

/**
 * Quotes API client
 */
export const quotesApi = {
  /**
   * List quotes with pagination and filters
   */
  async list(params: QuoteListParams = {}): Promise<PaginatedQuotes> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.page_size) queryParams.append("page_size", params.page_size.toString());
    if (params.search) queryParams.append("search", params.search);
    if (params.status) queryParams.append("status", params.status);
    if (params.customer_id) queryParams.append("customer_id", params.customer_id);
    if (params.sort_by) queryParams.append("sort_by", params.sort_by);
    if (params.sort_order) queryParams.append("sort_order", params.sort_order);

    return apiClient.get<PaginatedQuotes>(`/api/quotes?${queryParams.toString()}`);
  },

  /**
   * Get a single quote by ID
   */
  async get(id: string): Promise<Quote> {
    return apiClient.get<Quote>(`/api/quotes/${id}`);
  },

  /**
   * Create a new quote
   */
  async create(data: QuoteCreate): Promise<Quote> {
    return apiClient.post<Quote>("/api/quotes", data);
  },

  /**
   * Update an existing quote
   */
  async update(id: string, data: QuoteUpdate): Promise<Quote> {
    return apiClient.put<Quote>(`/api/quotes/${id}`, data);
  },

  /**
   * Delete a quote
   */
  async delete(id: string): Promise<void> {
    return apiClient.delete(`/api/quotes/${id}`);
  },

  /**
   * Convert quote to order
   */
  async convertToOrder(id: string): Promise<{ order_id: string; order_number: string }> {
    return apiClient.post<{ order_id: string; order_number: string }>(
      `/api/quotes/${id}/convert-to-order`
    );
  },

  /**
   * Generate AI-powered quote
   */
  async generate(data: GenerateQuoteRequest): Promise<Quote> {
    return apiClient.post<Quote>("/api/quotes/generate", data);
  },
};
