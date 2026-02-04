/**
 * Inventory domain types (shared between frontend and backend)
 */

import type { StockByLocation } from "./products";

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

export interface StockHealth {
  critical: StockHealthItem[];
  low: StockHealthItem[];
  warning: StockHealthItem[];
}

export interface TransferSuggestion {
  product_id: string;
  sku: string;
  name: string;
  from_location: string;
  to_location: string;
  suggested_quantity: number;
  reason: string;
}

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

export interface StockTransferCreate {
  product_id: string;
  from_location: string;
  to_location: string;
  quantity: number;
  notes?: string;
}

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

export interface StockReservationCreate {
  product_id: string;
  location: string;
  quantity: number;
  reserved_for: string;
  expires_at?: string;
  notes?: string;
}

export interface StockAdjustment {
  product_id: string;
  location: string;
  quantity: number;
  adjustment_type: "add" | "remove" | "set";
  reason: string;
  notes?: string;
}

export interface InventoryItem {
  product_id: string;
  sku: string;
  name: string;
  total_stock: number;
  total_reserved: number;
  total_available: number;
  locations: StockByLocation[];
}

export interface InventoryListParams {
  page?: number;
  page_size?: number;
  search?: string;
  location?: string;
  low_stock?: boolean;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export interface TransferListParams {
  page?: number;
  page_size?: number;
  status?: string;
  product_id?: string;
  from_location?: string;
  to_location?: string;
}

export interface PaginatedInventory {
  items: InventoryItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PaginatedTransfers {
  items: StockTransfer[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
