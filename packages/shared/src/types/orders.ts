/**
 * Order domain types (shared between frontend and backend)
 */

export type OrderStatus =
  | "draft"
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: string;
  line_total: string;
  created_at?: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name?: string;
  status: OrderStatus;
  total: string;
  order_date: string;
  fulfillment_location?: string;
  tracking_number?: string;
  carrier_name?: string;
  shipped_date?: string;
  estimated_delivery_date?: string;
  notes?: string;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface OrderCreate {
  customer_id: string;
  status?: OrderStatus;
  order_date?: string;
  fulfillment_location?: string;
  notes?: string;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_price: string;
  }>;
}

export interface OrderUpdate {
  customer_id?: string;
  status?: OrderStatus;
  fulfillment_location?: string;
  tracking_number?: string;
  carrier_name?: string;
  shipped_date?: string;
  estimated_delivery_date?: string;
  notes?: string;
  items?: Array<{
    id?: string;
    product_id: string;
    quantity: number;
    unit_price: string;
  }>;
}

export interface OrderListParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: OrderStatus;
  customer_id?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export interface PaginatedOrders {
  items: Order[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface OrderActivity {
  id: string;
  order_id: string;
  action: string;
  description: string;
  user_id?: string;
  user_name?: string;
  created_at: string;
}
