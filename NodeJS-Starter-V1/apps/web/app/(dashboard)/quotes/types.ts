/**
 * Shared types for Quotes module
 */

export interface Quote {
  id: string;
  quote_number: string;
  customer_name?: string;
  customer_id?: string;
  status: string;
  total?: string;
  quote_date: string;
  valid_until?: string | null;
  item_count?: number;
  notes?: string;
  quote_items?: any[];
  items?: any[];
}

export interface Customer {
  id: string;
  customer_number: string;
  company_name: string;
}

export interface LineItem {
  id?: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}
