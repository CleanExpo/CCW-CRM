import { apiClient } from '@/lib/api/client';

// UNI-1847: Values must match backend ServiceStatus enum exactly
export type ServiceStatus =
  | 'submitted'
  | 'quoted'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

// UNI-1847: Values must match backend RequestType enum exactly
export type RequestType = 'repair' | 'maintenance' | 'installation';

export interface ServiceRequest {
  id: string;
  customer_id: string;
  order_id: string | null;
  request_type: string;
  status: string;
  equipment_description: string;
  issue_description: string;
  photos: string[] | null;
  assigned_technician: string | null;
  scheduled_date: string | null;
  quote_amount: number | null;
  approved_amount: number | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceRequestCreate {
  customer_id: string;
  request_type: RequestType;
  equipment_description: string;
  issue_description: string;
  photos?: string[] | null;
}

export interface ServiceRequestUpdate {
  status?: ServiceStatus;
  assigned_technician?: string | null;
  scheduled_date?: string | null;
  quote_amount?: number | null;
  approved_amount?: number | null;
  order_id?: string | null;
}

export interface PaginatedServiceRequestsResponse {
  items: ServiceRequest[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export async function getServiceRequests(params?: {
  page?: number;
  page_size?: number;
  customer_id?: string;
  status?: string;
  search?: string;
}): Promise<PaginatedServiceRequestsResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.page_size) query.set('page_size', String(params.page_size));
  if (params?.customer_id) query.set('customer_id', params.customer_id);
  if (params?.status) query.set('status', params.status);
  if (params?.search) query.set('search', params.search);
  const qs = query.toString();
  return apiClient.get<PaginatedServiceRequestsResponse>(
    `/api/service-requests${qs ? `?${qs}` : ''}`
  );
}

export async function getServiceRequest(id: string): Promise<ServiceRequest> {
  return apiClient.get<ServiceRequest>(`/api/service-requests/${id}`);
}

export async function createServiceRequest(data: ServiceRequestCreate): Promise<ServiceRequest> {
  return apiClient.post<ServiceRequest>('/api/service-requests', data);
}

export async function updateServiceRequest(
  id: string,
  data: ServiceRequestUpdate
): Promise<ServiceRequest> {
  return apiClient.patch<ServiceRequest>(`/api/service-requests/${id}`, data);
}

export async function deleteServiceRequest(id: string): Promise<void> {
  return apiClient.delete(`/api/service-requests/${id}`);
}
