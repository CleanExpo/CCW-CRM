/**
 * TypeScript types for Purchase Orders.
 *
 * Purchase Orders allow bidirectional calculation:
 * - Mode A: Enter unit_cost → calculates subtotal
 * - Mode B: Enter subtotal → calculates unit_cost
 */

/**
 * Calculation mode for PO line items.
 * Determines which field is editable and which is calculated.
 */
export type CalculationMode = "unit_cost" | "subtotal";

/**
 * Purchase Order line item.
 */
export interface PurchaseOrderItem {
  id?: string;
  product_id: string;
  product_name?: string;
  product_sku?: string;
  quantity: number;
  quantity_received: number;
  unit_cost: number;
  subtotal: number;
  calculationMode: CalculationMode; // Frontend-only field for toggle state
}

/**
 * Purchase Order status enum.
 */
export type PurchaseOrderStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "ordered"
  | "in_transit"
  | "received"
  | "cancelled";

/**
 * Warehouse delivery locations.
 */
export type DeliveryLocation = "brisbane" | "sydney" | "melbourne";

/**
 * Complete Purchase Order.
 */
export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier_name?: string;
  supplier_code?: string;
  delivery_location: DeliveryLocation;
  status: PurchaseOrderStatus;
  order_date?: string;
  expected_delivery_date?: string;
  actual_delivery_date?: string;
  subtotal: number;
  tax: number;
  shipping_cost?: number;
  total: number;
  notes?: string;
  items: PurchaseOrderItem[];
  created_at: string;
  updated_at?: string;
}

/**
 * Data for creating a new Purchase Order.
 */
export interface PurchaseOrderCreate {
  supplier_id: string;
  delivery_location: DeliveryLocation;
  expected_delivery_date?: string;
  notes?: string;
  shipping_cost?: number;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_cost: number;
  }>;
}

/**
 * Data for updating a Purchase Order.
 */
export interface PurchaseOrderUpdate {
  supplier_id?: string;
  delivery_location?: DeliveryLocation;
  expected_delivery_date?: string;
  notes?: string;
  shipping_cost?: number;
  status?: PurchaseOrderStatus;
}

/**
 * Supplier information.
 */
export interface Supplier {
  id: string;
  supplier_code: string;
  company_name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  is_active: boolean;
}

/**
 * Paginated response for Purchase Orders.
 */
export interface PurchaseOrdersResponse {
  items: PurchaseOrder[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * Status badge color mapping.
 */
export const STATUS_COLORS: Record<PurchaseOrderStatus, string> = {
  draft: "bg-gray-100 text-gray-800",
  pending_approval: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  ordered: "bg-indigo-100 text-indigo-800",
  in_transit: "bg-purple-100 text-purple-800",
  received: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

/**
 * Status display names.
 */
export const STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  ordered: "Ordered",
  in_transit: "In Transit",
  received: "Received",
  cancelled: "Cancelled",
};

/**
 * Location display names.
 */
export const LOCATION_LABELS: Record<DeliveryLocation, string> = {
  brisbane: "Brisbane",
  sydney: "Sydney",
  melbourne: "Melbourne",
};
