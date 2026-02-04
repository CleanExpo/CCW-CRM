import { apiClient } from "./client";

/**
 * Product category enum
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

/**
 * Stock by location
 */
export interface StockByLocation {
  location: string;
  stock: number;
  reserved: number;
  available: number;
}

/**
 * Product interface
 */
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

/**
 * Product create request
 */
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

/**
 * Product update request
 */
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

/**
 * Product list params
 */
export interface ProductListParams {
  page?: number;
  page_size?: number;
  search?: string;
  category?: ProductCategory;
  is_active?: boolean;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

/**
 * Paginated product response
 */
export interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * Products API client
 */
export const productsApi = {
  /**
   * List products with pagination, search, category filter
   */
  async list(params: ProductListParams = {}): Promise<PaginatedProducts> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.page_size) queryParams.append("page_size", params.page_size.toString());
    if (params.search) queryParams.append("search", params.search);
    if (params.category) queryParams.append("category", params.category);
    if (params.is_active !== undefined) queryParams.append("is_active", params.is_active.toString());
    if (params.sort_by) queryParams.append("sort_by", params.sort_by);
    if (params.sort_order) queryParams.append("sort_order", params.sort_order);

    return apiClient.get<PaginatedProducts>(`/api/products?${queryParams.toString()}`);
  },

  /**
   * Get a single product by ID
   */
  async get(id: string): Promise<Product> {
    return apiClient.get<Product>(`/api/products/${id}`);
  },

  /**
   * Create a new product
   */
  async create(data: ProductCreate): Promise<Product> {
    return apiClient.post<Product>("/api/products", data);
  },

  /**
   * Update an existing product
   */
  async update(id: string, data: ProductUpdate): Promise<Product> {
    return apiClient.put<Product>(`/api/products/${id}`, data);
  },

  /**
   * Soft delete a product (set is_active = false)
   */
  async delete(id: string): Promise<void> {
    return apiClient.delete(`/api/products/${id}`);
  },
};
