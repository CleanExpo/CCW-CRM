/**
 * Product domain types (shared between frontend and backend)
 */

export type ProductCategory =
  | "heavy_machinery"
  | "hand_tools"
  | "power_tools"
  | "safety_equipment"
  | "building_materials"
  | "electrical"
  | "plumbing"
  | "accessories";

export interface StockByLocation {
  location: string;
  stock: number;
  reserved: number;
  available: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category?: ProductCategory;
  price: string;
  cost: string;
  stock: number;
  warehouse_location?: string;
  stock_by_location?: StockByLocation[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductCreate {
  sku: string;
  name: string;
  description?: string;
  category?: ProductCategory;
  price: string;
  cost: string;
  stock: number;
  warehouse_location?: string;
}

export interface ProductUpdate {
  sku?: string;
  name?: string;
  description?: string;
  category?: ProductCategory;
  price?: string;
  cost?: string;
  stock?: number;
  warehouse_location?: string;
  is_active?: boolean;
}

export interface ProductListParams {
  page?: number;
  page_size?: number;
  search?: string;
  category?: ProductCategory;
  is_active?: boolean;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
