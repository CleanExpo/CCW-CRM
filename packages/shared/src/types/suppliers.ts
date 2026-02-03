/**
 * Supplier domain types (shared between frontend and backend)
 */

export interface Supplier {
  id: string;
  supplier_code: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  abn?: string;
  payment_terms?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierCreate {
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  abn?: string;
  payment_terms?: string;
  notes?: string;
}

export interface SupplierUpdate {
  company_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  abn?: string;
  payment_terms?: string;
  notes?: string;
  is_active?: boolean;
}

export interface SupplierListParams {
  page?: number;
  page_size?: number;
  search?: string;
  is_active?: boolean;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export interface PaginatedSuppliers {
  items: Supplier[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
