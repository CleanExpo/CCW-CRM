/**
 * SLA API Client
 *
 * Provides methods for interacting with the SLA (Service Level Agreement)
 * endpoints. SLA instances track deadlines and breach status for various
 * entity types (activities, approvals, orders, etc.).
 */

import { apiClient } from './client';

export interface SLAInstance {
  id: string;
  sla_rule_id: string;
  entity_id: string;
  entity_type: string;
  deadline: string;
  breached: boolean;
  breach_notified: boolean;
  created_at: string;
}

export interface SLARule {
  id: string;
  name: string;
  entity_type: string;
  sla_hours: number;
  escalation_action: string;
  is_active: boolean;
}

export const slaApi = {
  /**
   * List all SLA rules
   * GET /api/sla/rules
   */
  getRules: (): Promise<SLARule[]> => apiClient.get<SLARule[]>('/api/sla/rules'),

  /**
   * List SLA instances with optional filters
   * GET /api/sla/instances?entity_type=...&breached=...
   */
  getInstances: (params?: { entity_type?: string; breached?: boolean }): Promise<SLAInstance[]> => {
    const query = new URLSearchParams();
    if (params?.entity_type) query.append('entity_type', params.entity_type);
    if (params?.breached !== undefined) query.append('breached', String(params.breached));
    const qs = query.toString();
    return apiClient.get<SLAInstance[]>(`/api/sla/instances${qs ? `?${qs}` : ''}`);
  },

  /**
   * Get SLA instances for a specific entity
   * GET /api/sla/instances/{entity_id}
   */
  getEntitySLAs: (entityId: string): Promise<SLAInstance[]> =>
    apiClient.get<SLAInstance[]>(`/api/sla/instances/${entityId}`),
};
