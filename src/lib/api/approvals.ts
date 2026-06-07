import { apiClient } from './client';

/**
 * Approvals API client
 * Approvals API: `/api/approvals/*` Route Handlers.
 */

export interface ApprovalStep {
  id: string;
  step_number: number;
  approver_id: string;
  approver_role: string | null;
  status: string;
  comments: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface Approval {
  id: string;
  approval_type: string;
  entity_id: string;
  entity_type: string;
  status: string;
  total_steps: number;
  current_step: number;
  requested_by: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  steps: ApprovalStep[];
}

export interface PaginatedApprovalResponse {
  data: Approval[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CreateApprovalRequest {
  approval_type: string;
  entity_id: string;
  entity_type: string;
  total_steps: number;
  requested_by: string;
  notes?: string;
}

export interface AddApprovalStepRequest {
  step_number: number;
  approver_id: string;
  approver_role?: string;
}

export interface ReviewStepRequest {
  /** Backend field name is 'action', not 'status' */
  action: 'approve' | 'reject';
  comments?: string;
}

export const approvalsApi = {
  /**
   * List approval workflows with optional filters
   * GET /api/approvals
   */
  async list(params?: {
    page?: number;
    page_size?: number;
    status_filter?: string;
    approval_type?: string;
  }): Promise<PaginatedApprovalResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.page_size) query.append('page_size', String(params.page_size));
    if (params?.status_filter) query.append('status_filter', params.status_filter);
    if (params?.approval_type) query.append('approval_type', params.approval_type);
    const qs = query.toString();
    return apiClient.get<PaginatedApprovalResponse>(`/api/approvals${qs ? `?${qs}` : ''}`);
  },

  /**
   * Get a single approval by ID
   * GET /api/approvals/{approval_id}
   */
  async get(id: string): Promise<Approval> {
    return apiClient.get<Approval>(`/api/approvals/${id}`);
  },

  /**
   * Create a new approval workflow
   * POST /api/approvals
   */
  async create(data: CreateApprovalRequest): Promise<Approval> {
    return apiClient.post<Approval>('/api/approvals', data);
  },

  /**
   * Add a step to an approval workflow
   * POST /api/approvals/{approval_id}/steps
   */
  async addStep(approvalId: string, data: AddApprovalStepRequest): Promise<ApprovalStep> {
    return apiClient.post<ApprovalStep>(`/api/approvals/${approvalId}/steps`, data);
  },

  /**
   * Review (approve or reject) an approval step
   * PUT /api/approvals/{approval_id}/steps/{step_id}
   */
  async reviewStep(
    approvalId: string,
    stepId: string,
    data: ReviewStepRequest
  ): Promise<ApprovalStep> {
    return apiClient.put<ApprovalStep>(`/api/approvals/${approvalId}/steps/${stepId}`, data);
  },

  /**
   * Cancel an approval workflow
   * DELETE /api/approvals/{approval_id}
   */
  async cancel(id: string): Promise<void> {
    return apiClient.delete(`/api/approvals/${id}`);
  },

  async getPendingMyApproval(): Promise<Approval[]> {
    return apiClient.get<Approval[]>('/api/approvals/pending-my-approval');
  },

  async bulkApprove(approvalIds: string[], comments?: string) {
    return apiClient.post<{
      total: number;
      succeeded: number;
      failed: number;
      results: Array<{ approval_id: string; success: boolean; error?: string }>;
    }>('/api/approvals/bulk-approve', { approval_ids: approvalIds, comments });
  },
};
