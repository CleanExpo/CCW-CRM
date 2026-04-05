/**
 * Contractor API Client
 *
 * Connects Next.js frontend to FastAPI backend.
 * Handles Australian context (AEST timezone, DD/MM/YYYY dates).
 */

import React from 'react';

import { apiClient } from '@/lib/api/client';
import type {
  AvailabilitySlot,
  AvailabilitySlotCreate,
  AvailabilityStatus,
  AustralianState,
  Contractor,
  ContractorCreate,
  ContractorListResponse,
  ContractorUpdate,
} from '@/types/contractor';

/**
 * Contractor API Client
 */
export const contractorAPI = {
  /**
   * List all contractors with pagination and filtering
   */
  async list(params?: {
    page?: number;
    pageSize?: number;
    state?: AustralianState;
    specialisation?: string;
  }): Promise<ContractorListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.pageSize) queryParams.set('page_size', params.pageSize.toString());
    if (params?.state) queryParams.set('state', params.state);
    if (params?.specialisation) queryParams.set('specialisation', params.specialisation);

    return apiClient.get<ContractorListResponse>(`/api/contractors/?${queryParams.toString()}`);
  },

  /**
   * Get contractor by ID with availability slots
   */
  async get(contractorId: string): Promise<Contractor> {
    return apiClient.get<Contractor>(`/api/contractors/${contractorId}`);
  },

  /**
   * Create new contractor
   */
  async create(data: ContractorCreate): Promise<Contractor> {
    return apiClient.post<Contractor>('/api/contractors/', data);
  },

  /**
   * Update contractor details (partial update)
   */
  async update(contractorId: string, data: ContractorUpdate): Promise<Contractor> {
    return apiClient.patch<Contractor>(`/api/contractors/${contractorId}`, data);
  },

  /**
   * Delete contractor
   */
  async delete(contractorId: string): Promise<void> {
    return apiClient.delete<void>(`/api/contractors/${contractorId}`);
  },

  /**
   * Add availability slot for contractor
   */
  async addAvailability(
    contractorId: string,
    data: AvailabilitySlotCreate,
  ): Promise<AvailabilitySlot> {
    return apiClient.post<AvailabilitySlot>(
      `/api/contractors/${contractorId}/availability`,
      data,
    );
  },

  /**
   * Get contractor's availability slots with optional status filter
   */
  async getAvailability(
    contractorId: string,
    status?: AvailabilityStatus,
  ): Promise<AvailabilitySlot[]> {
    const queryParams = status ? `?status=${status}` : '';
    return apiClient.get<AvailabilitySlot[]>(
      `/api/contractors/${contractorId}/availability${queryParams}`,
    );
  },

  /**
   * Search contractors by suburb
   */
  async searchByLocation(params: {
    suburb: string;
    state?: AustralianState;
    page?: number;
    pageSize?: number;
  }): Promise<ContractorListResponse> {
    const queryParams = new URLSearchParams();
    queryParams.set('suburb', params.suburb);
    if (params.state) queryParams.set('state', params.state);
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.pageSize) queryParams.set('page_size', params.pageSize.toString());

    return apiClient.get<ContractorListResponse>(
      `/api/contractors/search/by-location?${queryParams.toString()}`,
    );
  },
};

/**
 * React hook for contractor data fetching with loading/error states
 */
export function useContractor(contractorId: string) {
  const [contractor, setContractor] = React.useState<Contractor | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;

    async function fetchContractor() {
      try {
        setLoading(true);
        setError(null);
        const data = await contractorAPI.get(contractorId);
        if (mounted) {
          setContractor(data);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load contractor');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchContractor();

    return () => {
      mounted = false;
    };
  }, [contractorId]);

  return { contractor, loading, error };
}
