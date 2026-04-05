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

export const warehouseApi = {
  /** Get live warehouse operations feed (receiving, pick/pack, returns, AI guidance) */
  getOps: (): Promise<WarehouseOpsPayload> => apiClient.get('/api/warehouse/ops'),
};
