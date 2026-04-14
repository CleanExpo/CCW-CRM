/**
 * Customer domain types (shared between frontend and backend)
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

export interface CustomerListParams {
  page?: number;
  page_size?: number;
  search?: string;
  is_active?: boolean;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedCustomers {
  items: Customer[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
