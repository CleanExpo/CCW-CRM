/**
 * Contacts API Client
 *
 * Provides methods for interacting with the CRM contacts endpoints.
 */

import { apiClient } from "./client";
import type {
  Contact,
  ContactWithCustomer,
  CreateContactRequest,
  UpdateContactRequest,
  PaginatedContacts,
} from "@/lib/types/contacts";

/**
 * Parameters for listing contacts
 */
export interface ContactListParams {
  page?: number;
  page_size?: number;
  search?: string;
  customer_id?: string;
  is_active?: boolean;
}

/**
 * Contacts API methods
 */
export const contactsApi = {
  /**
   * List contacts with pagination and filters
   */
  async list(params: ContactListParams = {}): Promise<PaginatedContacts> {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append("page", params.page.toString());
    if (params.page_size) queryParams.append("page_size", params.page_size.toString());
    if (params.search) queryParams.append("search", params.search);
    if (params.customer_id) queryParams.append("customer_id", params.customer_id);
    if (params.is_active !== undefined) {
      queryParams.append("is_active", params.is_active.toString());
    }

    const url = `/api/contacts${queryParams.toString() ? `?${queryParams}` : ""}`;
    return apiClient.get<PaginatedContacts>(url);
  },

  /**
   * Get a single contact by ID with customer details
   */
  async get(id: string): Promise<ContactWithCustomer> {
    return apiClient.get<ContactWithCustomer>(`/api/contacts/${id}`);
  },

  /**
   * Create a new contact
   */
  async create(data: CreateContactRequest): Promise<Contact> {
    return apiClient.post<Contact>("/api/contacts", data);
  },

  /**
   * Update an existing contact
   */
  async update(id: string, data: UpdateContactRequest): Promise<Contact> {
    return apiClient.put<Contact>(`/api/contacts/${id}`, data);
  },

  /**
   * Delete (soft-delete) a contact
   */
  async delete(id: string): Promise<void> {
    return apiClient.delete(`/api/contacts/${id}`);
  },

  /**
   * Get all contacts for a specific customer
   */
  async getCustomerContacts(
    customerId: string,
    includeInactive = false
  ): Promise<Contact[]> {
    const url = `/api/contacts/customer/${customerId}${includeInactive ? "?include_inactive=true" : ""}`;
    return apiClient.get<Contact[]>(url);
  },

  /**
   * Set a contact as primary for their customer
   */
  async setPrimary(contactId: string): Promise<Contact> {
    return apiClient.post<Contact>(`/api/contacts/${contactId}/set-primary`, {});
  },
};
