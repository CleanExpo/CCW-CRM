/**
 * Quote domain types (shared between frontend and backend)
 */

export type QuoteStatus = 'draft' | 'pending' | 'sent' | 'accepted' | 'rejected' | 'expired';

export interface QuoteItem {
  id: string;
  quote_id: string;
  product_id: string;
  quantity: number;
  unit_price: string;
  line_total: string;
  created_at?: string;
}

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

export interface QuoteListParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: QuoteStatus;
  customer_id?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedQuotes {
  items: Quote[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface GenerateQuoteRequest {
  customer_id: string;
  requirements: string;
  context?: Record<string, any>;
}
