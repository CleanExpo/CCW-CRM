import { apiClient } from './client';

/**
 * Outbound shipment status
 */
export type OutboundShipmentStatus =
  | 'pending'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'exception'
  | 'returned';

/**
 * Location options for warehouse origin
 */
export type WarehouseLocation = 'brisbane' | 'sydney' | 'melbourne';

/**
 * Outbound shipment interface (matches backend OutboundShipmentResponse)
 */
export interface OutboundShipment {
  id: string;
  shipment_number: string;
  order_id: string;
  carrier_name?: string;
  carrier_service?: string;
  tracking_number?: string;
  origin_location: WarehouseLocation;
  destination_address?: string;
  status: OutboundShipmentStatus;
  shipped_date?: string;
  expected_delivery_date?: string;
  actual_delivery_date?: string;
  tracking_events?: unknown;
  last_tracking_update?: string;
  notes?: string;
  created_at: string;
}

/**
 * Outbound shipment create request (matches backend OutboundShipmentCreate)
 */
export interface OutboundShipmentCreate {
  order_id: string;
  carrier_name?: string;
  carrier_service?: string;
  tracking_number?: string;
  origin_location: WarehouseLocation;
  destination_address?: string;
  shipped_date?: string;
  expected_delivery_date?: string;
  notes?: string;
}

/**
 * Outbound shipment update request (matches backend OutboundShipmentUpdate)
 */
export interface OutboundShipmentUpdate {
  carrier_name?: string;
  carrier_service?: string;
  tracking_number?: string;
  status?: OutboundShipmentStatus;
  shipped_date?: string;
  expected_delivery_date?: string;
  actual_delivery_date?: string;
  notes?: string;
}

/**
 * Outbound shipment list params
 */
export interface OutboundShipmentListParams {
  page?: number;
  page_size?: number;
  location?: WarehouseLocation;
  status?: OutboundShipmentStatus;
  order_id?: string;
  tracking_number?: string;
}

/**
 * Paginated outbound shipment response (matches backend PaginatedOutboundResponse)
 */
export interface PaginatedOutboundShipments {
  data: OutboundShipment[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * Outbound Shipments API client
 */
export const outboundShipmentsApi = {
  /**
   * List outbound shipments with pagination and filters
   */
  async list(params: OutboundShipmentListParams = {}): Promise<PaginatedOutboundShipments> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.page_size) queryParams.append('page_size', params.page_size.toString());
    if (params.location) queryParams.append('location', params.location);
    if (params.status) queryParams.append('status', params.status);
    if (params.order_id) queryParams.append('order_id', params.order_id);
    if (params.tracking_number) queryParams.append('tracking_number', params.tracking_number);

    return apiClient.get<PaginatedOutboundShipments>(
      `/api/shipments/outbound?${queryParams.toString()}`
    );
  },

  /**
   * Get a single outbound shipment by ID
   */
  async get(id: string): Promise<OutboundShipment> {
    return apiClient.get<OutboundShipment>(`/api/shipments/outbound/${id}`);
  },

  /**
   * Create a new outbound shipment
   */
  async create(data: OutboundShipmentCreate): Promise<OutboundShipment> {
    return apiClient.post<OutboundShipment>('/api/shipments/outbound', data);
  },

  /**
   * Update an existing outbound shipment
   */
  async update(id: string, data: OutboundShipmentUpdate): Promise<OutboundShipment> {
    return apiClient.put<OutboundShipment>(`/api/shipments/outbound/${id}`, data);
  },

  /**
   * Delete an outbound shipment (soft delete)
   */
  async delete(id: string): Promise<void> {
    return apiClient.delete(`/api/shipments/outbound/${id}`);
  },
};
