/**
 * Shipment domain types (shared between frontend and backend)
 */

export type ShipmentStatus =
  | "pending"
  | "in_transit"
  | "delivered"
  | "cancelled"
  | "returned";

export interface Shipment {
  id: string;
  shipment_number: string;
  order_id: string;
  order_number?: string;
  customer_id?: string;
  customer_name?: string;
  status: ShipmentStatus;
  carrier_name: string;
  tracking_number: string;
  shipping_method?: string;
  shipped_date?: string;
  estimated_delivery_date?: string;
  actual_delivery_date?: string;
  shipping_address?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_postcode?: string;
  shipping_country?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ShipmentCreate {
  order_id: string;
  carrier_name: string;
  tracking_number: string;
  shipping_method?: string;
  shipped_date?: string;
  estimated_delivery_date?: string;
  shipping_address?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_postcode?: string;
  shipping_country?: string;
  notes?: string;
}

export interface ShipmentUpdate {
  status?: ShipmentStatus;
  carrier_name?: string;
  tracking_number?: string;
  shipping_method?: string;
  shipped_date?: string;
  estimated_delivery_date?: string;
  actual_delivery_date?: string;
  shipping_address?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_postcode?: string;
  shipping_country?: string;
  notes?: string;
}

export interface ShipmentListParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: ShipmentStatus;
  carrier?: string;
  order_id?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export interface PaginatedShipments {
  items: Shipment[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface TrackingUpdate {
  status: ShipmentStatus;
  location?: string;
  timestamp?: string;
  notes?: string;
}
