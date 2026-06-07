// Contact types mirroring backend CRM schemas

/**
 * Core Contact interface (mirrors backend Contact model)
 */
export interface Contact {
  id: string;
  customer_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  job_title: string | null;
  department: string | null;
  is_primary: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Contact with resolved customer name
 */
export interface ContactWithCustomer extends Contact {
  customer_name?: string;
}

/**
 * Request payload for creating a new contact
 */
export interface CreateContactRequest {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  job_title?: string;
  department?: string;
  customer_id?: string;
  is_primary?: boolean;
  is_active?: boolean;
  notes?: string;
}

/**
 * Request payload for updating an existing contact (all fields optional)
 */
export interface UpdateContactRequest {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  job_title?: string;
  department?: string;
  customer_id?: string;
  is_primary?: boolean;
  is_active?: boolean;
  notes?: string;
}

/**
 * Paginated response for contacts list endpoint
 */
export interface PaginatedContacts {
  data: ContactWithCustomer[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * Contact statistics
 */
export interface ContactStats {
  total_contacts: number;
  active_contacts: number;
  contacts_with_email: number;
  contacts_by_customer: number;
}
