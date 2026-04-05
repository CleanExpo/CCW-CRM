/**
 * Cin7 Goods Receipt Note (GRN) API client.
 *
 * Typed client for the GRN workflow: create receipts, add lines, confirm.
 */

import { apiClient } from './client';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface GoodsReceiptLine {
  id: string;
  goods_receipt_id: string;
  product_id: string | null;
  sku: string;
  product_name: string;
  ordered_qty: number | null;
  received_qty: number;
  put_away_location: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  condition: 'good' | 'damaged' | 'short';
  notes: string | null;
}

export interface GoodsReceipt {
  id: string;
  cin7_po_mapping_id: string | null;
  po_reference: string;
  supplier_name: string | null;
  received_by: string | null;
  received_date: string;
  location_id: string;
  notes: string | null;
  status: 'draft' | 'confirmed' | 'synced' | 'failed';
  cin7_receipt_id: string | null;
  total_items_received: number;
  created_at: string;
  confirmed_at: string | null;
  synced_at: string | null;
  lines: GoodsReceiptLine[];
}

export interface GoodsReceiptListResponse {
  items: GoodsReceipt[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CreateGoodsReceiptRequest {
  po_reference: string;
  supplier_name?: string;
  received_by?: string;
  received_date?: string;
  location_id?: string;
  notes?: string;
}

export interface AddGoodsReceiptLineRequest {
  product_id?: string;
  sku: string;
  product_name: string;
  ordered_qty?: number;
  received_qty: number;
  put_away_location?: string;
  batch_number?: string;
  expiry_date?: string;
  condition?: 'good' | 'damaged' | 'short';
  notes?: string;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const cin7GrnApi = {
  /** Create a new draft Goods Receipt Note */
  createGoodsReceipt: (data: CreateGoodsReceiptRequest): Promise<GoodsReceipt> =>
    apiClient.post('/api/cin7/goods-receipts', data),

  /** List goods receipts with optional status filter */
  listGoodsReceipts: (
    status?: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<GoodsReceiptListResponse> => {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (status) params.append('status', status);
    return apiClient.get(`/api/cin7/goods-receipts?${params.toString()}`);
  },

  /** Get a single GRN with all lines */
  getGoodsReceipt: (id: string): Promise<GoodsReceipt> =>
    apiClient.get(`/api/cin7/goods-receipts/${id}`),

  /** Add a line item to a draft GRN */
  addGoodsReceiptLine: (
    grnId: string,
    data: AddGoodsReceiptLineRequest
  ): Promise<GoodsReceiptLine> => apiClient.post(`/api/cin7/goods-receipts/${grnId}/lines`, data),

  /** Remove a line item from a draft GRN */
  removeGoodsReceiptLine: (grnId: string, lineId: string): Promise<void> =>
    apiClient.delete(`/api/cin7/goods-receipts/${grnId}/lines/${lineId}`),

  /** Confirm a goods receipt (validates lines, syncs to Cin7) */
  confirmGoodsReceipt: (id: string): Promise<GoodsReceipt> =>
    apiClient.post(`/api/cin7/goods-receipts/${id}/confirm`),
};
