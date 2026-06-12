import { apiClient } from './client';
import type {
  InventoryItem,
  StockByLocation,
  StockTransfer,
  StockReservation,
  StockHealth,
  StockAlert,
  CreateStockTransferRequest,
  CreateStockReservationRequest,
  CreateStockAdjustmentRequest,
  PaginatedInventoryResponse,
  PaginatedTransfersResponse,
  LocationStockResponse,
  StoreLocation,
  TransferStatus,
  InventoryDashboardSummary,
} from '@/types/inventory';

/**
 * Barcode lookup response — mirrors BarcodeProductResponse on the backend.
 */
export interface BarcodeProduct {
  product_id: string;
  product_name: string;
  sku: string;
  barcodes: Array<{ barcode: string; barcode_type: string }>;
  stock_by_location: Array<{ location: string; stock_quantity: number }>;
}

/**
 * Stock health item interface (legacy - for backward compatibility)
 */
export interface StockHealthItem {
  product_id: string;
  sku: string;
  name: string;
  stock: number;
  reserved: number;
  available: number;
  reorder_point?: number;
  locations?: StockByLocation[];
}

/**
 * Transfer suggestion interface
 */
export interface TransferSuggestion {
  product_id: string;
  sku: string;
  name: string;
  from_location: string;
  to_location: string;
  suggested_quantity: number;
  reason: string;
}

/**
 * Inventory list params
 */
export interface InventoryListParams {
  page?: number;
  page_size?: number;
  search?: string;
  location?: string;
  low_stock?: boolean;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

/**
 * Transfer list params
 */
export interface TransferListParams {
  page?: number;
  page_size?: number;
  status?: string;
  product_id?: string;
  from_location?: string;
  to_location?: string;
}

/**
 * Inventory API client
 * Inventory API: `/api/inventory/*` Route Handlers.
 */
export const inventoryApi = {
  /**
   * List all inventory with pagination and filters
   * GET /api/inventory
   */
  async list(params: InventoryListParams = {}): Promise<PaginatedInventoryResponse> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.page_size) queryParams.append('page_size', params.page_size.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.location) queryParams.append('location', params.location);
    if (params.low_stock !== undefined)
      queryParams.append('low_stock', params.low_stock.toString());
    if (params.sort_by) queryParams.append('sort_by', params.sort_by);
    if (params.sort_order) queryParams.append('sort_order', params.sort_order);

    return apiClient.get<PaginatedInventoryResponse>(`/api/inventory?${queryParams.toString()}`);
  },

  /**
   * Get stock by specific location
   * GET /api/inventory/by-location
   * Returns LocationStockResponse (different item shape from InventoryItem list)
   */
  async getStockByLocation(
    location: string,
    params: InventoryListParams = {}
  ): Promise<LocationStockResponse> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.page_size) queryParams.append('page_size', params.page_size.toString());
    if (params.search) queryParams.append('search', params.search);

    return apiClient.get<LocationStockResponse>(
      `/api/inventory/by-location?location=${location}&${queryParams.toString()}`
    );
  },

  /**
   * Get low stock products
   * GET /api/inventory/low-stock
   */
  async getLowStock(threshold: number = 20): Promise<StockHealthItem[]> {
    return apiClient.get<StockHealthItem[]>(`/api/inventory/low-stock?threshold=${threshold}`);
  },

  /**
   * Get stock health analysis
   * GET /api/inventory/stock-health
   */
  async getStockHealth(threshold: number = 20): Promise<StockHealth> {
    return apiClient.get<StockHealth>(`/api/inventory/stock-health?threshold=${threshold}`);
  },

  /**
   * Get transfer suggestions
   * GET /api/inventory/transfer-suggestions
   */
  async getTransferSuggestions(): Promise<TransferSuggestion[]> {
    const res = await apiClient.get<{
      suggestions: Array<{
        product_id: string;
        product_sku: string;
        product_name: string;
        from_location: string;
        to_location: string;
        suggested_quantity: number;
        reason: string;
      }>;
    }>('/api/inventory/transfer-suggestions');
    return res.suggestions.map((s) => ({
      product_id: s.product_id,
      sku: s.product_sku,
      name: s.product_name,
      from_location: s.from_location,
      to_location: s.to_location,
      suggested_quantity: s.suggested_quantity,
      reason: s.reason,
    }));
  },

  /**
   * Get product stock by all locations
   * GET /api/inventory/product/{productId}/locations
   */
  async getProductStock(productId: string): Promise<StockByLocation[]> {
    return apiClient.get<StockByLocation[]>(`/api/inventory/product/${productId}/locations`);
  },

  /**
   * Create stock transfer
   * POST /api/inventory/transfer
   */
  async createTransfer(data: CreateStockTransferRequest): Promise<StockTransfer> {
    return apiClient.post<StockTransfer>('/api/inventory/transfer', data);
  },

  /**
   * Get transfer history
   * GET /api/inventory/transfers
   */
  async getTransfers(params: TransferListParams = {}): Promise<PaginatedTransfersResponse> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.page_size) queryParams.append('page_size', params.page_size.toString());
    if (params.status) queryParams.append('status', params.status);
    if (params.product_id) queryParams.append('product_id', params.product_id);
    if (params.from_location) queryParams.append('from_location', params.from_location);
    if (params.to_location) queryParams.append('to_location', params.to_location);

    return apiClient.get<PaginatedTransfersResponse>(
      `/api/inventory/transfers?${queryParams.toString()}`
    );
  },

  /**
   * Cancel a stock transfer (pending or in_transit only).
   * POST /api/inventory/transfers/:id/cancel
   */
  async cancelTransfer(id: string): Promise<StockTransfer> {
    return apiClient.post<StockTransfer>(`/api/inventory/transfers/${id}/cancel`, {});
  },
  /**
   * Reserve stock
   * POST /api/inventory/reserve
   */
  async reserveStock(data: CreateStockReservationRequest): Promise<StockReservation> {
    return apiClient.post<StockReservation>('/api/inventory/reserve', data);
  },

  /**
   * Release stock reservation
   * POST /api/inventory/release/{id}
   */
  async releaseReservation(id: string): Promise<void> {
    return apiClient.post(`/api/inventory/release/${id}`, {});
  },

  /**
   * Adjust stock levels
   * POST /api/inventory/adjust
   */
  async adjustStock(data: CreateStockAdjustmentRequest): Promise<void> {
    return apiClient.post('/api/inventory/adjust', data);
  },

  /**
   * Get inventory dashboard summary statistics
   * GET /api/inventory/summary
   */
  async getSummary(): Promise<InventoryDashboardSummary> {
    return apiClient.get<InventoryDashboardSummary>('/api/inventory/summary');
  },

  /**
   * Update reorder point and quantity for a product at a location
   * PATCH /api/inventory/reorder-settings/{productId}/{location}
   */
  async updateReorderSettings(
    productId: string,
    location: string,
    reorderPoint: number,
    reorderQty: number
  ): Promise<void> {
    return apiClient.patch(`/api/inventory/reorder-settings/${productId}/${location}`, {
      reorder_point: reorderPoint,
      reorder_quantity: reorderQty,
    });
  },

  /**
   * Look up a product by barcode value
   * GET /api/inventory/barcode/{code}
   */
  async lookupByBarcode(code: string): Promise<BarcodeProduct> {
    return apiClient.get<BarcodeProduct>(`/api/inventory/barcode/${encodeURIComponent(code)}`);
  },

  /**
   * Add a barcode to a product
   * POST /api/inventory/barcode
   */
  async addBarcode(
    productId: string,
    barcode: string,
    barcodeType: string = 'EAN13'
  ): Promise<void> {
    return apiClient.post('/api/inventory/barcode', {
      product_id: productId,
      barcode,
      barcode_type: barcodeType,
    });
  },

  /**
   * Remove a barcode by its value
   * DELETE /api/inventory/barcode/{code}
   */
  async removeBarcode(code: string): Promise<void> {
    return apiClient.delete(`/api/inventory/barcode/${encodeURIComponent(code)}`);
  },

  // ── Stock Take ──────────────────────────────────────────────────────────────

  async startStockTake(
    location: string
  ): Promise<{ id: string; location: string; status: string; created_at: string }> {
    return apiClient.post('/api/inventory/stock-take', { location });
  },

  async getStockTakes(params?: { location?: string; status?: string }): Promise<
    Array<{
      id: string;
      location: string;
      status: string;
      created_at: string;
      submitted_at: string | null;
    }>
  > {
    const q = new URLSearchParams();
    if (params?.location) q.append('location', params.location);
    if (params?.status) q.append('status', params.status);
    const qs = q.toString();
    return apiClient.get(`/api/inventory/stock-takes${qs ? `?${qs}` : ''}`);
  },

  async submitStockTake(
    takeId: string,
    items: Array<{ product_id: string; counted_qty: number }>
  ): Promise<{ success: boolean; take_id: string; items_processed: number }> {
    return apiClient.post(`/api/inventory/stock-take/${takeId}/submit`, { items });
  },

  // ── Reorder Rules ───────────────────────────────────────────────────────────

  async getReorderRules(location?: string): Promise<
    Array<{
      id: string;
      product_id: string;
      location: string;
      supplier_id: string | null;
      auto_approve_under_qty: number;
      lead_time_days: number;
      is_enabled: boolean;
    }>
  > {
    const qs = location ? `?location=${location}` : '';
    return apiClient.get(`/api/inventory/reorder-rules${qs}`);
  },

  async saveReorderRule(data: {
    product_id: string;
    location: string;
    supplier_id?: string;
    auto_approve_under_qty?: number;
    lead_time_days?: number;
    is_enabled?: boolean;
  }): Promise<{ id: string }> {
    return apiClient.post('/api/inventory/reorder-rules', data);
  },

  // ── Reorder Alerts ──────────────────────────────────────────────────────────

  async getReorderAlerts(location?: string): Promise<
    Array<{
      product_id: string;
      sku: string;
      name: string;
      location: string;
      stock: number;
      reorder_point: number;
      reorder_quantity: number | null;
      supplier_id: string | null;
      supplier_name: string | null;
    }>
  > {
    const qs = location ? `?location=${location}` : '';
    return apiClient.get(`/api/inventory/reorder-alerts${qs}`);
  },

  async triggerAutoReorder(
    productId: string,
    location: string
  ): Promise<{
    success: boolean;
    po_number: string;
    po_id: string;
    status: string;
    quantity: number;
  }> {
    return apiClient.post(
      `/api/inventory/auto-reorder?product_id=${productId}&location=${location}`,
      {}
    );
  },

  // ── Product Attributes ──────────────────────────────────────────────────────

  async getProductAttributes(
    productId: string
  ): Promise<
    Array<{ id: string; key: string; value: string; unit: string | null; created_at: string }>
  > {
    return apiClient.get(`/api/inventory/products/${productId}/attributes`);
  },

  async addProductAttribute(
    productId: string,
    key: string,
    value: string,
    unit?: string
  ): Promise<{ id: string; key: string; value: string; unit: string | null }> {
    return apiClient.post(`/api/inventory/products/${productId}/attributes`, { key, value, unit });
  },

  async deleteProductAttribute(productId: string, attributeId: string): Promise<void> {
    return apiClient.delete(`/api/inventory/products/${productId}/attributes/${attributeId}`);
  },

  // ── Product Variants ────────────────────────────────────────────────────────

  async getProductVariants(productId: string): Promise<
    Array<{
      id: string;
      variant_sku: string;
      name: string;
      attributes: Record<string, string> | null;
      price_override: number | null;
      is_active: boolean;
      created_at: string;
    }>
  > {
    return apiClient.get(`/api/inventory/products/${productId}/variants`);
  },

  async createProductVariant(
    productId: string,
    data: {
      variant_sku: string;
      name: string;
      attributes?: Record<string, string>;
      price_override?: number;
      is_active?: boolean;
    }
  ): Promise<{ id: string; variant_sku: string; name: string }> {
    return apiClient.post(`/api/inventory/products/${productId}/variants`, data);
  },

  async deleteProductVariant(productId: string, variantId: string): Promise<void> {
    return apiClient.delete(`/api/inventory/products/${productId}/variants/${variantId}`);
  },
};
