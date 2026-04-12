/**
 * Shared types for Orders module
 */

import type { OrderStatus } from '@/lib/api/orders';

export interface Order {
  id: string;
  order_number: string;
  customer_name?: string;
  customer_id?: string;
  status: OrderStatus;
  total?: string;
  order_date?: string;
  fulfillment_location?: string | null;
  tracking_number?: string | null;
  carrier_name?: string | null;
  shipped_date?: string | null;
  estimated_delivery_date?: string | null;
  item_count?: number;
  notes?: string;
  order_items?: OrderItem[];
  items?: OrderItem[];
}

export interface OrderActivity {
  id: string;
  order_id: string;
  event_type: string;
  message: string;
  created_by?: string | null;
  created_at: string;
  meta_data?: Record<string, unknown> | null;
}

export interface Customer {
  id: string;
  customer_number: string;
  company_name: string;
}

export interface OrderItem {
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
