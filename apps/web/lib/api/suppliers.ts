import { apiClient } from "./client";

/**
 * Supplier interface
 */
export interface Supplier {
  id: string;
  supplier_code: string;
  company_name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country: string;
  abn?: string;
  payment_terms?: string;
  preferred_carrier?: string;
  notes?: string;
  is_active: boolean;
  xero_contact_id?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Supplier create request
 */
export interface SupplierCreate {
  supplier_code: string;
  company_name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  abn?: string;
  payment_terms?: string;
  preferred_carrier?: string;
  notes?: string;
}

/**
 * Supplier update request
 */
export interface SupplierUpdate {
  company_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  abn?: string;
  payment_terms?: string;
  preferred_carrier?: string;
  notes?: string;
  is_active?: boolean;
}

/**
 * Supplier list params
 */
export interface SupplierListParams {
  page?: number;
  page_size?: number;
  search?: string;
  is_active?: boolean;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

/**
 * Paginated supplier response
 */
export interface PaginatedSuppliers {
  items: Supplier[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * Suppliers API client
 */
export const suppliersApi = {
  /**
   * List suppliers with pagination, search, and filters
   */
  async list(params: SupplierListParams = {}): Promise<PaginatedSuppliers> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.page_size) queryParams.append("page_size", params.page_size.toString());
    if (params.search) queryParams.append("search", params.search);
    if (params.is_active !== undefined) queryParams.append("is_active", params.is_active.toString());
    if (params.sort_by) queryParams.append("sort_by", params.sort_by);
    if (params.sort_order) queryParams.append("sort_order", params.sort_order);

    return apiClient.get<PaginatedSuppliers>(`/api/suppliers?${queryParams.toString()}`);
  },

  /**
   * Get a single supplier by ID
   */
  async get(id: string): Promise<Supplier> {
    return apiClient.get<Supplier>(`/api/suppliers/${id}`);
  },

  /**
   * Create a new supplier
   */
  async create(data: SupplierCreate): Promise<Supplier> {
    return apiClient.post<Supplier>("/api/suppliers", data);
  },

  /**
   * Update an existing supplier
   */
  async update(id: string, data: SupplierUpdate): Promise<Supplier> {
    return apiClient.put<Supplier>(`/api/suppliers/${id}`, data);
  },

  /**
   * Delete a supplier (soft delete - sets is_active = false)
   */
  async delete(id: string): Promise<void> {
    return apiClient.delete(`/api/suppliers/${id}`);
  },
};
