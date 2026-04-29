/**
 * Shared types for Quotes module
 */

export interface Quote {
  id: string;
  quote_number: string;
  customer_name?: string;
  customer_id?: string;
  status: string;
  total?: string | number;
  quote_date?: string;
  created_at?: string;
  valid_until?: string | null;
  item_count?: number;
  notes?: string;
  fulfillment_location?: string | null;
  quote_items?: QuoteItem[];
  items?: QuoteItem[];
}

export interface Customer {
  id: string;
  customer_number: string;
  company_name: string;
}

export interface QuoteItem {
  id?: string;
  product_id?: string;
  product_name?: string;
  quantity: number;
  unit_price: number;
  line_total?: number;
}

export interface LineItem {
  id?: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}
