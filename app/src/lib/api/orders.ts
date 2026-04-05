import { apiClient } from "./client";

/**
 * Order status enum matching backend
 */
export type OrderStatus =
  | "draft"
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

/**
 * Order item interface
 */
export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: string;
  line_total: string;
  created_at?: string;
}

/**
 * Order interface
 */
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

/**
 * Order create request
 */
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

/**
 * Order update request
 */
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

/**
 * Order list params
 */
export interface OrderListParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: OrderStatus;
  customer_id?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

/**
 * Paginated order response
 */
export interface PaginatedOrders {
  items: Order[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * Activity item for order history
 */
export interface OrderActivity {
  id: string;
  order_id: string;
  action: string;
  description: string;
  user_id?: string;
  user_name?: string;
  created_at: string;
}

/**
 * Orders API client
 */
export const ordersApi = {
  /**
   * List orders with pagination and filters
   */
  async list(params: OrderListParams = {}): Promise<PaginatedOrders> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.page_size) queryParams.append("page_size", params.page_size.toString());
    if (params.search) queryParams.append("search", params.search);
    if (params.status) queryParams.append("status", params.status);
    if (params.customer_id) queryParams.append("customer_id", params.customer_id);
    if (params.sort_by) queryParams.append("sort_by", params.sort_by);
    if (params.sort_order) queryParams.append("sort_order", params.sort_order);

    return apiClient.get<PaginatedOrders>(`/api/orders?${queryParams.toString()}`);
  },

  /**
   * Get a single order by ID
   */
  async get(id: string): Promise<Order> {
    return apiClient.get<Order>(`/api/orders/${id}`);
  },

  /**
   * Create a new order
   */
  async create(data: OrderCreate): Promise<Order> {
    return apiClient.post<Order>("/api/orders", data);
  },

  /**
   * Update an existing order
   */
  async update(id: string, data: OrderUpdate): Promise<Order> {
    return apiClient.put<Order>(`/api/orders/${id}`, data);
  },

  /**
   * Delete an order
   */
  async delete(id: string): Promise<void> {
    return apiClient.delete(`/api/orders/${id}`);
  },

  /**
   * Get order activity/history
   */
  async getActivity(id: string): Promise<OrderActivity[]> {
    return apiClient.get<OrderActivity[]>(`/api/orders/${id}/activity`);
  },

  /**
   * Update order status
   */
  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    return apiClient.put<Order>(`/api/orders/${id}/status`, { status });
  },
};
