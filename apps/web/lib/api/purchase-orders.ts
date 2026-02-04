import { apiClient } from "./client";

/**
 * Purchase order status enum
 */
export type PurchaseOrderStatus =
  | "draft"
  | "sent"
  | "confirmed"
  | "partial"
  | "received"
  | "cancelled";

/**
 * Purchase order item interface
 */
export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  product_id: string;
  product_sku?: string;
  product_name?: string;
  quantity: number;
  unit_price: string;
  line_total: string;
  received_quantity?: number;
  created_at?: string;
}

/**
 * Purchase order interface
 */
export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier_name?: string;
  status: PurchaseOrderStatus;
  total: string;
  order_date: string;
  expected_delivery_date?: string;
  delivery_location?: string;
  notes?: string;
  items: PurchaseOrderItem[];
  created_at: string;
  updated_at: string;
}

/**
 * Purchase order create request
 */
export interface PurchaseOrderCreate {
  supplier_id: string;
  status?: PurchaseOrderStatus;
  order_date?: string;
  expected_delivery_date?: string;
  delivery_location?: string;
  notes?: string;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_price: string;
  }>;
}

/**
 * Purchase order update request
 */
export interface PurchaseOrderUpdate {
  supplier_id?: string;
  status?: PurchaseOrderStatus;
  expected_delivery_date?: string;
  delivery_location?: string;
  notes?: string;
  items?: Array<{
    id?: string;
    product_id: string;
    quantity: number;
    unit_price: string;
  }>;
}

/**
 * Purchase order list params
 */
export interface PurchaseOrderListParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: PurchaseOrderStatus;
  supplier_id?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

/**
 * Paginated purchase order response
 */
export interface PaginatedPurchaseOrders {
  items: PurchaseOrder[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * Receipt record interface
 */
export interface Receipt {
  id: string;
  purchase_order_id: string;
  purchase_order_item_id: string;
  quantity_received: number;
  received_date: string;
  received_by?: string;
  location?: string;
  condition?: string;
  notes?: string;
  created_at: string;
}

/**
 * Receive stock request
 */
export interface ReceiveStockRequest {
  items: Array<{
    purchase_order_item_id: string;
    quantity_received: number;
    location?: string;
    condition?: string;
    notes?: string;
  }>;
  received_date?: string;
}

/**
 * Purchase Orders API client
 */
export const purchaseOrdersApi = {
  /**
   * List purchase orders with pagination and filters
   */
  async list(params: PurchaseOrderListParams = {}): Promise<PaginatedPurchaseOrders> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.page_size) queryParams.append("page_size", params.page_size.toString());
    if (params.search) queryParams.append("search", params.search);
    if (params.status) queryParams.append("status", params.status);
    if (params.supplier_id) queryParams.append("supplier_id", params.supplier_id);
    if (params.sort_by) queryParams.append("sort_by", params.sort_by);
    if (params.sort_order) queryParams.append("sort_order", params.sort_order);

    return apiClient.get<PaginatedPurchaseOrders>(`/api/purchase-orders?${queryParams.toString()}`);
  },

  /**
   * Get a single purchase order by ID
   */
  async get(id: string): Promise<PurchaseOrder> {
    return apiClient.get<PurchaseOrder>(`/api/purchase-orders/${id}`);
  },

  /**
   * Create a new purchase order
   */
  async create(data: PurchaseOrderCreate): Promise<PurchaseOrder> {
    return apiClient.post<PurchaseOrder>("/api/purchase-orders", data);
  },

  /**
   * Update an existing purchase order
   */
  async update(id: string, data: PurchaseOrderUpdate): Promise<PurchaseOrder> {
    return apiClient.put<PurchaseOrder>(`/api/purchase-orders/${id}`, data);
  },

  /**
   * Delete a purchase order
   */
  async delete(id: string): Promise<void> {
    return apiClient.delete(`/api/purchase-orders/${id}`);
  },

  /**
   * Update purchase order status
   */
  async updateStatus(id: string, status: PurchaseOrderStatus): Promise<PurchaseOrder> {
    return apiClient.put<PurchaseOrder>(`/api/purchase-orders/${id}/status`, { status });
  },

  /**
   * Get receipts for a purchase order
   */
  async getReceipts(id: string): Promise<Receipt[]> {
    return apiClient.get<Receipt[]>(`/api/purchase-orders/${id}/receipts`);
  },

  /**
   * Receive stock for a purchase order
   */
  async receiveStock(id: string, data: ReceiveStockRequest): Promise<Receipt[]> {
    return apiClient.post<Receipt[]>(`/api/purchase-orders/${id}/receive`, data);
  },
};
