/**
 * Warehouse API client.
 *
 * Typed client for warehouse operations endpoints.
 */

import { apiClient } from './client';

export interface WarehouseOpsMetrics {
  inboundToday: number;
  inboundDocked: number;
  inboundScheduled: number;
  picksDueToday: number;
  rushPicks: number;
  returnsOpen: number;
  returnSlaRisk: number;
  onTimeRate: number;
}

export interface ReceivingShipment {
  id: string;
  supplier: string;
  container: string;
  eta: string;
  dock: string;
  items: number;
  status: string;
  priority: string;
}

export interface PickOrder {
  id: string;
  customer: string;
  zone: string;
  lines: number;
  promised: string;
  status: string;
  priority: string;
}

export interface ReturnCase {
  id: string;
  customer: string;
  reason: string;
  items: number;
  sla: string;
  status: string;
}

export interface WarehouseGuidance {
  title: string;
  detail: string;
  impact: string;
}

export interface WarehouseOpsPayload {
  updatedAt: string;
  metrics: WarehouseOpsMetrics;
  receivingQueue: ReceivingShipment[];
  pickQueue: PickOrder[];
  returnsQueue: ReturnCase[];
  aiGuidance: WarehouseGuidance[];
}

export interface PickListLineItem {
  order_id: string;
  order_number: string;
  product_id: string;
  sku: string;
  description: string;
  bin_location: string | null;
  qty_ordered: number;
  qty_picked: number;
}

export interface PickListResponse {
  id: string;
  pick_list_number: string;
  created_at: string;
  order_ids: string[];
  customer_names: string[];
  line_items: PickListLineItem[];
  total_lines: number;
}

export const warehouseApi = {
  /** Get live warehouse operations feed (receiving, pick/pack, returns, AI guidance) */
  getOps: (): Promise<WarehouseOpsPayload> => apiClient.get('/api/warehouse/ops'),

  /** Create a pick list for the given order IDs */
  createPickList: (order_ids: string[]): Promise<PickListResponse> =>
    apiClient.post('/api/warehouse/pick-lists', { order_ids }),

  /** Get a previously generated pick list by ID */
  getPickList: (id: string): Promise<PickListResponse> =>
    apiClient.get(`/api/warehouse/pick-lists/${id}`),
};
