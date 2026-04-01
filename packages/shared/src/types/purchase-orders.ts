/**
 * Purchase Order domain types (shared between frontend and backend)
 */

export type PurchaseOrderStatus =
  | "draft"
  | "sent"
  | "confirmed"
  | "partial"
  | "received"
  | "cancelled";

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

export interface PurchaseOrderListParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: PurchaseOrderStatus;
  supplier_id?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export interface PaginatedPurchaseOrders {
  items: PurchaseOrder[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

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
