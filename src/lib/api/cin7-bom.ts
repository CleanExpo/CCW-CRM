/**
 * Cin7 BOM (Bill of Materials) and Production Run API client.
 *
 * Covers BOM masters, BOM components, and production run lifecycle management.
 * Endpoints are served under `/api/cin7/bom`.
 */

import { apiClient } from './client';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface Cin7BomComponent {
  id: string;
  bom_master_id: string;
  component_sku: string;
  component_name: string;
  /** Decimal string, e.g. "2.0000" */
  quantity: string;
  uom: string;
  /** Decimal string for percentage, e.g. "5.00" */
  wastage_percent: string;
  notes: string | null;
}

export interface Cin7BomMaster {
  id: string;
  cin7_bom_id: string;
  name: string;
  sku: string;
  version: string;
  /** "active" | "draft" | "archived" */
  status: string;
  finished_good_sku: string | null;
  finished_good_name: string | null;
  /** Decimal string, e.g. "1.0000" */
  quantity_produced: string;
  uom: string;
  notes: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
  components: Cin7BomComponent[];
}

export interface BomListResponse {
  items: Cin7BomMaster[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface SyncBomsResponse {
  status: string;
  boms_synced: number;
  message: string;
}

export interface Cin7ProductionRun {
  id: string;
  bom_master_id: string;
  bom_name: string;
  cin7_production_id: string | null;
  /** Decimal string */
  quantity_planned: string;
  /** Decimal string */
  quantity_completed: string;
  /** "planned" | "in_progress" | "completed" | "cancelled" */
  status: string;
  planned_date: string | null;
  completed_date: string | null;
  location_id: string | null;
  notes: string | null;
  cin7_synced: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductionRunListResponse {
  items: Cin7ProductionRun[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CreateProductionRunData {
  bom_master_id: string;
  quantity_planned: number;
  planned_date?: string | null;
  location_id?: string | null;
  notes?: string | null;
}

export interface UpdateProductionRunStatusData {
  /** "planned" | "in_progress" | "completed" | "cancelled" */
  status: string;
  quantity_completed?: number | null;
  completed_date?: string | null;
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * List BOM masters, optionally filtered by status.
 */
export function listBoms(page = 1, pageSize = 20, status?: string): Promise<BomListResponse> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (status) params.set('status', status);
  return apiClient.get<BomListResponse>(`/api/cin7/bom?${params.toString()}`);
}

/**
 * Trigger a sync of BOM masters from Cin7 (demo: upserts 3 demo BOMs).
 */
export function syncBoms(): Promise<SyncBomsResponse> {
  return apiClient.post<SyncBomsResponse>('/api/cin7/bom/sync', {});
}

/**
 * Fetch a single BOM master with all its component lines.
 */
export function getBom(bomId: string): Promise<Cin7BomMaster> {
  return apiClient.get<Cin7BomMaster>(`/api/cin7/bom/${bomId}`);
}

/**
 * List production runs, optionally filtered by status.
 */
export function listProductionRuns(
  page = 1,
  pageSize = 20,
  status?: string
): Promise<ProductionRunListResponse> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (status) params.set('status', status);
  return apiClient.get<ProductionRunListResponse>(
    `/api/cin7/bom/production-runs?${params.toString()}`
  );
}

/**
 * Create a new production run against an existing BOM master.
 */
export function createProductionRun(data: CreateProductionRunData): Promise<Cin7ProductionRun> {
  return apiClient.post<Cin7ProductionRun>('/api/cin7/bom/production-runs', data);
}

/**
 * Advance the status of a production run (planned -> in_progress -> completed | cancelled).
 */
export function updateProductionRunStatus(
  id: string,
  data: UpdateProductionRunStatusData
): Promise<Cin7ProductionRun> {
  return apiClient.patch<Cin7ProductionRun>(`/api/cin7/bom/production-runs/${id}/status`, data);
}
