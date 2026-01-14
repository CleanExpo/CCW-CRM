/**
 * Shared types for Orders module
 */

export interface Order {
  id: string;
  order_number: string;
  customer_name?: string;
  customer_id?: string;
  status: string;
  total?: string;
  order_date?: string;
  item_count?: number;
  notes?: string;
  order_items?: any[];
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
