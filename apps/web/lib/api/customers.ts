import { apiClient } from "./client";

/**
 * Customer interface
 */
export interface Customer {
  id: string;
  customer_number: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  xero_contact_id?: string;
  xero_synced_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Customer create request
 */
export interface CustomerCreate {
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

/**
 * Customer update request
 */
export interface CustomerUpdate {
  company_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  is_active?: boolean;
}

/**
 * Customer list params
 */
export interface CustomerListParams {
  page?: number;
  page_size?: number;
  search?: string;
  is_active?: boolean;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

/**
 * Paginated customer response
 */
export interface PaginatedCustomers {
  items: Customer[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * Customers API client
 */
export const customersApi = {
  /**
   * List customers with pagination, search, and filters
   */
  async list(params: CustomerListParams = {}): Promise<PaginatedCustomers> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.page_size) queryParams.append("page_size", params.page_size.toString());
    if (params.search) queryParams.append("search", params.search);
    if (params.is_active !== undefined) queryParams.append("is_active", params.is_active.toString());
    if (params.sort_by) queryParams.append("sort_by", params.sort_by);
    if (params.sort_order) queryParams.append("sort_order", params.sort_order);

    return apiClient.get<PaginatedCustomers>(`/api/customers?${queryParams.toString()}`);
  },

  /**
   * Get a single customer by ID
   */
  async get(id: string): Promise<Customer> {
    return apiClient.get<Customer>(`/api/customers/${id}`);
  },

  /**
   * Create a new customer
   */
  async create(data: CustomerCreate): Promise<Customer> {
    return apiClient.post<Customer>("/api/customers", data);
  },

  /**
   * Update an existing customer
   */
  async update(id: string, data: CustomerUpdate): Promise<Customer> {
    return apiClient.put<Customer>(`/api/customers/${id}`, data);
  },

  /**
   * Soft delete a customer (set is_active = false)
   */
  async delete(id: string): Promise<void> {
    return apiClient.delete(`/api/customers/${id}`);
  },
};
