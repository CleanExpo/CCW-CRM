import { apiClient } from "./client";
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
  StoreLocation,
  TransferStatus,
} from "@/lib/types/inventory";

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
  sort_order?: "asc" | "desc";
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
 * Backend routes: apps/backend/src/api/routes/inventory.py
 */
export const inventoryApi = {
  /**
   * List all inventory with pagination and filters
   * GET /api/inventory
   */
  async list(params: InventoryListParams = {}): Promise<PaginatedInventoryResponse> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.page_size) queryParams.append("page_size", params.page_size.toString());
    if (params.search) queryParams.append("search", params.search);
    if (params.location) queryParams.append("location", params.location);
    if (params.low_stock !== undefined) queryParams.append("low_stock", params.low_stock.toString());
    if (params.sort_by) queryParams.append("sort_by", params.sort_by);
    if (params.sort_order) queryParams.append("sort_order", params.sort_order);

    return apiClient.get<PaginatedInventoryResponse>(`/api/inventory?${queryParams.toString()}`);
  },

  /**
   * Get stock by specific location
   * GET /api/inventory/by-location
   */
  async getStockByLocation(location: string, params: InventoryListParams = {}): Promise<PaginatedInventoryResponse> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.page_size) queryParams.append("page_size", params.page_size.toString());
    if (params.search) queryParams.append("search", params.search);

    return apiClient.get<PaginatedInventoryResponse>(`/api/inventory/by-location?location=${location}&${queryParams.toString()}`);
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
    return apiClient.get<TransferSuggestion[]>("/api/inventory/transfer-suggestions");
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
    return apiClient.post<StockTransfer>("/api/inventory/transfer", data);
  },

  /**
   * Get transfer history
   * GET /api/inventory/transfers
   */
  async getTransfers(params: TransferListParams = {}): Promise<PaginatedTransfersResponse> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.page_size) queryParams.append("page_size", params.page_size.toString());
    if (params.status) queryParams.append("status", params.status);
    if (params.product_id) queryParams.append("product_id", params.product_id);
    if (params.from_location) queryParams.append("from_location", params.from_location);
    if (params.to_location) queryParams.append("to_location", params.to_location);

    return apiClient.get<PaginatedTransfersResponse>(`/api/inventory/transfers?${queryParams.toString()}`);
  },

  /**
   * Reserve stock
   * POST /api/inventory/reserve
   */
  async reserveStock(data: CreateStockReservationRequest): Promise<StockReservation> {
    return apiClient.post<StockReservation>("/api/inventory/reserve", data);
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
    return apiClient.post("/api/inventory/adjust", data);
  },
};
