import { apiClient } from "./client";

/**
 * Shipment status enum
 */
export type ShipmentStatus =
  | "pending"
  | "in_transit"
  | "delivered"
  | "cancelled"
  | "returned";

/**
 * Shipment interface
 */
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

/**
 * Shipment create request
 */
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

/**
 * Shipment update request
 */
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

/**
 * Shipment list params
 */
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

/**
 * Paginated shipment response
 */
export interface PaginatedShipments {
  items: Shipment[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * Tracking update interface
 */
export interface TrackingUpdate {
  status: ShipmentStatus;
  location?: string;
  timestamp?: string;
  notes?: string;
}

/**
 * Shipments API client
 */
export const shipmentsApi = {
  /**
   * List shipments with pagination and filters
   */
  async list(params: ShipmentListParams = {}): Promise<PaginatedShipments> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.page_size) queryParams.append("page_size", params.page_size.toString());
    if (params.search) queryParams.append("search", params.search);
    if (params.status) queryParams.append("status", params.status);
    if (params.carrier) queryParams.append("carrier", params.carrier);
    if (params.order_id) queryParams.append("order_id", params.order_id);
    if (params.sort_by) queryParams.append("sort_by", params.sort_by);
    if (params.sort_order) queryParams.append("sort_order", params.sort_order);

    return apiClient.get<PaginatedShipments>(`/api/shipments?${queryParams.toString()}`);
  },

  /**
   * Get a single shipment by ID
   */
  async get(id: string): Promise<Shipment> {
    return apiClient.get<Shipment>(`/api/shipments/${id}`);
  },

  /**
   * Create a new shipment
   */
  async create(data: ShipmentCreate): Promise<Shipment> {
    return apiClient.post<Shipment>("/api/shipments", data);
  },

  /**
   * Update an existing shipment
   */
  async update(id: string, data: ShipmentUpdate): Promise<Shipment> {
    return apiClient.put<Shipment>(`/api/shipments/${id}`, data);
  },

  /**
   * Delete a shipment
   */
  async delete(id: string): Promise<void> {
    return apiClient.delete(`/api/shipments/${id}`);
  },

  /**
   * Update shipment tracking
   */
  async updateTracking(id: string, data: TrackingUpdate): Promise<Shipment> {
    return apiClient.post<Shipment>(`/api/shipments/${id}/track`, data);
  },
};
