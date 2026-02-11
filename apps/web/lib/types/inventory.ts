/**
 * Inventory TypeScript Types
 * Mirrors backend Pydantic schemas from apps/backend/src/api/routes/inventory.py
 */

export enum StoreLocation {
  BRISBANE = "brisbane",
  SYDNEY = "sydney",
  MELBOURNE = "melbourne",
}

export enum TransferStatus {
  PENDING = "pending",
  IN_TRANSIT = "in_transit",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export enum ReservationStatus {
  ACTIVE = "active",
  FULFILLED = "fulfilled",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
}

export enum AdjustmentType {
  STOCK_COUNT = "stock_count",
  DAMAGE = "damage",
  THEFT = "theft",
  CORRECTION = "correction",
  TRANSFER = "transfer",
  SALE = "sale",
  RETURN = "return",
}

export interface StockByLocation {
  location: StoreLocation;
  stock: number;
  reserved: number;
  available: number;
  reorder_point?: number;
  reorder_quantity?: number;
  last_counted_at?: string;
  last_counted_by?: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  price: number;
  stock_by_location: StockByLocation[];
  total_stock: number;
  total_reserved: number;
  total_available: number;
  created_at: string;
  updated_at: string;
}

export interface StockTransfer {
  id: string;
  product_id: string;
  product_name?: string;  // Populated by backend join
  product_sku?: string;   // Populated by backend join
  from_location: StoreLocation;
  to_location: StoreLocation;
  quantity: number;
  status: TransferStatus;
  reason?: string;
  notes?: string;
  initiated_by: string;
  initiated_at: string;
  completed_by?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface StockReservation {
  id: string;
  product_id: string;
  product_name?: string;  // Populated by backend join
  product_sku?: string;   // Populated by backend join
  order_id: string;
  order_number?: string;  // Populated by backend join
  location: StoreLocation;
  quantity: number;
  status: ReservationStatus;
  reserved_by: string;
  reserved_at: string;
  expires_at?: string;
  fulfilled_at?: string;
  cancelled_at?: string;
  created_at: string;
  updated_at: string;
}

export interface StockAdjustment {
  id: string;
  product_id: string;
  product_name?: string;  // Populated by backend join
  product_sku?: string;   // Populated by backend join
  location: StoreLocation;
  adjustment_type: AdjustmentType;
  quantity_change: number;
  previous_quantity: number;
  new_quantity: number;
  reason?: string;
  reference_id?: string;
  adjusted_by: string;
  adjusted_at: string;
  created_at: string;
  updated_at: string;
}

export interface StockAlert {
  product_id: string;
  product_name: string;
  product_sku: string;
  location: StoreLocation;
  current_stock: number;
  available_stock: number;
  reorder_point: number;
  reorder_quantity: number;
  severity: "critical" | "low" | "normal";
}

export interface StockHealth {
  location: StoreLocation;
  total_products: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_stock_value: number;
  alerts: StockAlert[];
}

// Request Types

export interface CreateStockTransferRequest {
  product_id: string;
  from_location: StoreLocation;
  to_location: StoreLocation;
  quantity: number;
  reason?: string;
  notes?: string;
}

export interface UpdateTransferStatusRequest {
  status: TransferStatus;
  notes?: string;
}

export interface CreateStockReservationRequest {
  product_id: string;
  order_id: string;
  location: StoreLocation;
  quantity: number;
  expires_at?: string;  // ISO date string
}

export interface CreateStockAdjustmentRequest {
  product_id: string;
  location: StoreLocation;
  adjustment_type: AdjustmentType;
  quantity_change: number;
  reason?: string;
  reference_id?: string;
}

export interface StockLevelUpdate {
  location: StoreLocation;
  stock: number;
  reorder_point?: number;
  reorder_quantity?: number;
}

// Paginated Response Types

export interface PaginatedInventoryResponse {
  items: InventoryItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PaginatedTransfersResponse {
  items: StockTransfer[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PaginatedReservationsResponse {
  items: StockReservation[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PaginatedAdjustmentsResponse {
  items: StockAdjustment[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// Summary Types

export interface TransferSummary {
  id: string;
  product_name: string;
  product_sku: string;
  from_location: StoreLocation;
  to_location: StoreLocation;
  quantity: number;
  status: TransferStatus;
  initiated_at: string;
  initiated_by: string;
}

export interface ReservationSummary {
  id: string;
  product_name: string;
  product_sku: string;
  order_number: string;
  location: StoreLocation;
  quantity: number;
  status: ReservationStatus;
  expires_at?: string;
  reserved_at: string;
}

// Analytics Types

export interface InventorySummary {
  total_products: number;
  total_stock_value: number;
  low_stock_alerts: number;
  out_of_stock_alerts: number;
  total_reserved: number;
  active_transfers: number;
  active_reservations: number;
}

export interface LocationStock {
  location: StoreLocation;
  total_stock: number;
  total_reserved: number;
  total_available: number;
  stock_value: number;
  product_count: number;
}

/**
 * Helper type for transfer form data (used with React Hook Form)
 */
export interface TransferFormData {
  product_id: string;
  from_location: StoreLocation;
  to_location: StoreLocation;
  quantity: number;
  reason?: string;
  notes?: string;
}

/**
 * Helper type for reservation form data (used with React Hook Form)
 */
export interface ReservationFormData {
  product_id: string;
  order_id: string;
  location: StoreLocation;
  quantity: number;
  expires_in_hours?: number;
}

/**
 * Helper type for adjustment form data (used with React Hook Form)
 */
export interface AdjustmentFormData {
  product_id: string;
  location: StoreLocation;
  adjustment_type: AdjustmentType;
  quantity_change: number;
  reason?: string;
}
