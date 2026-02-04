import { apiClient } from "./client";

/**
 * Stock by location interface
 */
export interface StockByLocation {
  location: string;
  stock: number;
  reserved: number;
  available: number;
}

/**
 * Stock health item interface
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
 * Stock health response
 */
export interface StockHealth {
  critical: StockHealthItem[];
  low: StockHealthItem[];
  warning: StockHealthItem[];
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
 * Stock transfer interface
 */
export interface StockTransfer {
  id: string;
  product_id: string;
  from_location: string;
  to_location: string;
  quantity: number;
  status: "pending" | "in_transit" | "completed" | "cancelled";
  initiated_by?: string;
  completed_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Stock transfer create request
 */
export interface StockTransferCreate {
  product_id: string;
  from_location: string;
  to_location: string;
  quantity: number;
  notes?: string;
}

/**
 * Stock reservation interface
 */
export interface StockReservation {
  id: string;
  product_id: string;
  location: string;
  quantity: number;
  reserved_for: string;
  expires_at?: string;
  notes?: string;
  created_at: string;
}

/**
 * Stock reservation create request
 */
export interface StockReservationCreate {
  product_id: string;
  location: string;
  quantity: number;
  reserved_for: string;
  expires_at?: string;
  notes?: string;
}

/**
 * Stock adjustment interface
 */
export interface StockAdjustment {
  product_id: string;
  location: string;
  quantity: number;
  adjustment_type: "add" | "remove" | "set";
  reason: string;
  notes?: string;
}

/**
 * Inventory item interface
 */
export interface InventoryItem {
  product_id: string;
  sku: string;
  name: string;
  total_stock: number;
  total_reserved: number;
  total_available: number;
  locations: StockByLocation[];
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
 * Paginated inventory response
 */
export interface PaginatedInventory {
  items: InventoryItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * Paginated transfers response
 */
export interface PaginatedTransfers {
  items: StockTransfer[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * Inventory API client
 */
export const inventoryApi = {
  /**
   * List all inventory with pagination and filters
   */
  async list(params: InventoryListParams = {}): Promise<PaginatedInventory> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.page_size) queryParams.append("page_size", params.page_size.toString());
    if (params.search) queryParams.append("search", params.search);
    if (params.location) queryParams.append("location", params.location);
    if (params.low_stock !== undefined) queryParams.append("low_stock", params.low_stock.toString());
    if (params.sort_by) queryParams.append("sort_by", params.sort_by);
    if (params.sort_order) queryParams.append("sort_order", params.sort_order);

    return apiClient.get<PaginatedInventory>(`/api/inventory?${queryParams.toString()}`);
  },

  /**
   * Get stock by specific location
   */
  async getStockByLocation(location: string, params: InventoryListParams = {}): Promise<PaginatedInventory> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.page_size) queryParams.append("page_size", params.page_size.toString());
    if (params.search) queryParams.append("search", params.search);

    return apiClient.get<PaginatedInventory>(`/api/inventory/by-location?location=${location}&${queryParams.toString()}`);
  },

  /**
   * Get low stock products
   */
  async getLowStock(threshold: number = 20): Promise<StockHealthItem[]> {
    return apiClient.get<StockHealthItem[]>(`/api/inventory/low-stock?threshold=${threshold}`);
  },

  /**
   * Get stock health analysis
   */
  async getStockHealth(threshold: number = 20): Promise<StockHealth> {
    return apiClient.get<StockHealth>(`/api/inventory/stock-health?threshold=${threshold}`);
  },

  /**
   * Get transfer suggestions
   */
  async getTransferSuggestions(): Promise<TransferSuggestion[]> {
    return apiClient.get<TransferSuggestion[]>("/api/inventory/transfer-suggestions");
  },

  /**
   * Get product stock by all locations
   */
  async getProductStock(productId: string): Promise<StockByLocation[]> {
    return apiClient.get<StockByLocation[]>(`/api/inventory/product/${productId}/locations`);
  },

  /**
   * Create stock transfer
   */
  async createTransfer(data: StockTransferCreate): Promise<StockTransfer> {
    return apiClient.post<StockTransfer>("/api/inventory/transfer", data);
  },

  /**
   * Get transfer history
   */
  async getTransfers(params: TransferListParams = {}): Promise<PaginatedTransfers> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.page_size) queryParams.append("page_size", params.page_size.toString());
    if (params.status) queryParams.append("status", params.status);
    if (params.product_id) queryParams.append("product_id", params.product_id);
    if (params.from_location) queryParams.append("from_location", params.from_location);
    if (params.to_location) queryParams.append("to_location", params.to_location);

    return apiClient.get<PaginatedTransfers>(`/api/inventory/transfers?${queryParams.toString()}`);
  },

  /**
   * Reserve stock
   */
  async reserveStock(data: StockReservationCreate): Promise<StockReservation> {
    return apiClient.post<StockReservation>("/api/inventory/reserve", data);
  },

  /**
   * Release stock reservation
   */
  async releaseReservation(id: string): Promise<void> {
    return apiClient.post(`/api/inventory/release/${id}`, {});
  },

  /**
   * Adjust stock levels
   */
  async adjustStock(data: StockAdjustment): Promise<void> {
    return apiClient.post("/api/inventory/adjust", data);
  },
};
