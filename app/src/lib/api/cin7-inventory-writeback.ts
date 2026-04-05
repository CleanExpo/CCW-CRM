/**
 * Cin7 Inventory Write-Back API client (UNI-1265).
 *
 * Typed client for stock adjustments, stock transfers, and stock-takes
 * that are written back to Cin7.
 */

import { apiClient } from './client';

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

export interface StockAdjustmentRequest {
  location_id: string;
  product_id: string;
  sku: string;
  adjustment_qty: number;
  reason?: string | null;
}

export interface StockTransferRequest {
  from_location_id: string;
  to_location_id: string;
  product_id: string;
  sku: string;
  quantity: number;
  reference?: string | null;
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface StockAdjustmentRecord {
  id: string;
  location_id: string;
  product_id: string;
  sku: string;
  adjustment_qty: string;
  reason: string | null;
  cin7_adjustment_id: string | null;
  status: 'pending' | 'synced' | 'failed';
  error_message: string | null;
  created_at: string;
  synced_at: string | null;
}

export interface StockTransferRecord {
  id: string;
  from_location_id: string;
  to_location_id: string;
  product_id: string;
  sku: string;
  quantity: string;
  reference: string | null;
  cin7_transfer_id: string | null;
  status: 'pending' | 'synced' | 'failed';
  error_message: string | null;
  created_at: string;
  synced_at: string | null;
}

export interface StockAdjustmentListResponse {
  total: number;
  items: StockAdjustmentRecord[];
}

export interface StockTransferListResponse {
  total: number;
  items: StockTransferRecord[];
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const cin7InventoryWritebackApi = {
  /** Create a stock adjustment and sync to Cin7. */
  createStockAdjustment: (data: StockAdjustmentRequest): Promise<StockAdjustmentRecord> =>
    apiClient.post('/api/cin7/stock-adjustments', data),

  /** List recent stock adjustments. */
  listStockAdjustments: (limit = 50): Promise<StockAdjustmentListResponse> =>
    apiClient.get(`/api/cin7/stock-adjustments?limit=${limit}`),

  /** Create a stock transfer between locations and sync to Cin7. */
  createStockTransfer: (data: StockTransferRequest): Promise<StockTransferRecord> =>
    apiClient.post('/api/cin7/stock-transfers', data),

  /** List recent stock transfers. */
  listStockTransfers: (limit = 50): Promise<StockTransferListResponse> =>
    apiClient.get(`/api/cin7/stock-transfers?limit=${limit}`),
};
