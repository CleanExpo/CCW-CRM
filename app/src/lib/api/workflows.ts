/**
 * Workflow Automation API Client
 *
 * CRUD for workflow templates and read access to workflow instances.
 */

import { apiClient } from './client';

export interface WorkflowTemplateAction {
  id: string;
  template_id: string;
  action_type: string;
  action_config: Record<string, unknown> | null;
  order: number;
  created_at: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  trigger_event: string;
  trigger_conditions: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  actions: WorkflowTemplateAction[];
}

export interface WorkflowInstance {
  id: string;
  template_id: string | null;
  trigger_entity_type: string;
  trigger_entity_id: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export interface WorkflowTemplateCreateInput {
  name: string;
  description?: string;
  trigger_event: string;
  trigger_conditions?: Record<string, unknown>;
  is_active?: boolean;
}

export interface WorkflowTemplateUpdateInput {
  name?: string;
  description?: string;
  trigger_event?: string;
  trigger_conditions?: Record<string, unknown>;
  is_active?: boolean;
}

export const workflowsApi = {
  /** List all templates GET /api/workflows/templates */
  listTemplates: (): Promise<WorkflowTemplate[]> =>
    apiClient.get<WorkflowTemplate[]>('/api/workflows/templates'),

  /** Get single template GET /api/workflows/templates/{id} */
  getTemplate: (id: string): Promise<WorkflowTemplate> =>
    apiClient.get<WorkflowTemplate>(`/api/workflows/templates/${id}`),

  /** Create template POST /api/workflows/templates */
  createTemplate: (data: WorkflowTemplateCreateInput): Promise<WorkflowTemplate> =>
    apiClient.post<WorkflowTemplate>('/api/workflows/templates', data),

  /** Update template PUT /api/workflows/templates/{id} */
  updateTemplate: (id: string, data: WorkflowTemplateUpdateInput): Promise<WorkflowTemplate> =>
    apiClient.put<WorkflowTemplate>(`/api/workflows/templates/${id}`, data),

  /** Delete template DELETE /api/workflows/templates/{id} */
  deleteTemplate: (id: string): Promise<void> => apiClient.delete(`/api/workflows/templates/${id}`),

  /** List instances GET /api/workflows/instances */
  listInstances: (params?: {
    template_id?: string;
    status?: string;
  }): Promise<WorkflowInstance[]> => {
    const q = new URLSearchParams();
    if (params?.template_id) q.append('template_id', params.template_id);
    if (params?.status) q.append('status', params.status);
    const qs = q.toString();
    return apiClient.get<WorkflowInstance[]>(`/api/workflows/instances${qs ? `?${qs}` : ''}`);
  },
};
