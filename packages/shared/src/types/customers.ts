/**
 * Customer domain types (shared between frontend and backend)
 */

/** Per-customer AR payment terms, synced to the Xero contact's Sales PaymentTerms. */
export type PaymentTerms = "COD" | "NET7" | "NET14" | "NET30" | "NET60" | "EOM" | "EOM30";

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
  /** AR payment terms for this customer (synced to Xero contact). */
  payment_terms?: PaymentTerms;
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
  /** AR payment terms — one of COD, NET7, NET14, NET30, NET60, EOM, EOM30. */
  payment_terms?: PaymentTerms;
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
  /** AR payment terms — one of COD, NET7, NET14, NET30, NET60, EOM, EOM30. */
  payment_terms?: PaymentTerms;
  is_active?: boolean;
}

export interface CustomerListParams {
  page?: number;
  page_size?: number;
  search?: string;
  is_active?: boolean;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export interface PaginatedCustomers {
  items: Customer[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
