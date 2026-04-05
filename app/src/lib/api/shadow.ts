import { apiClient } from '@/lib/api/client';

export interface ShadowSessionResponse {
  id: string;
  client_name: string;
  status: string;
  start_date: string;
  target_end_date: string | null;
  completed_at: string | null;
  readiness_score: number | null;
  total_syncs_run: number;
  successful_syncs: number;
  products_observed: number;
  orders_observed: number;
  customers_observed: number;
  invoices_observed: number;
  day_number: number;
  days_remaining: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShadowStatusResponse {
  active: boolean;
  session: ShadowSessionResponse | null;
  day_number: number;
  days_remaining: number;
  readiness_score: number | null;
}

export interface ReadinessBreakdown {
  data_completeness: number;
  sync_accuracy: number;
  workflow_match: number;
  ai_confidence: number;
  integration_health: number;
}

export interface ReadinessScoreResponse {
  score: number;
  breakdown: ReadinessBreakdown;
  recommendation: string;
  ready_for_transition: boolean;
}

export interface StartShadowSessionRequest {
  client_name?: string;
  notes?: string;
  duration_days?: number;
}

export interface AiOpportunity {
  id: string;
  title: string;
  description: string;
  domain: string;
  agent: string;
  estimated_roi: string;
  confidence: number;
  status: string;
  endpoint: string;
}

export interface SyncGap {
  id: string;
  gap_type: string;
  entity_type: string;
  cin7_id: string;
  severity: string;
  status: string;
  field_name: string | null;
  cin7_value: string | null;
  erp_value: string | null;
  detected_at: string;
}

export const shadowApi = {
  getStatus: () => apiClient.get<ShadowStatusResponse>('/api/shadow/status'),

  getActiveSession: () =>
    apiClient.get<ShadowSessionResponse | null>('/api/shadow/session'),

  startSession: (body: StartShadowSessionRequest) =>
    apiClient.post<ShadowSessionResponse>('/api/shadow/session', body),

  endSession: (sessionId: string) =>
    apiClient.patch<ShadowSessionResponse>(`/api/shadow/session/${sessionId}/end`, {}),

  getReadinessScore: () =>
    apiClient.get<ReadinessScoreResponse>('/api/shadow/readiness-score'),

  getDailyStats: (days = 30) =>
    apiClient.get<{ session_id: string; day_count: number; stats: unknown[] }>(
      `/api/shadow/daily-stats?days=${days}`
    ),

  getTransitionReport: () =>
    apiClient.get<{
      session_id: string;
      score: number;
      ready_for_transition: boolean;
      report_markdown: string;
      generated_at: string;
    }>('/api/shadow/transition-report'),

  getPatterns: (limit = 20) =>
    apiClient.get<{ count: number; patterns: unknown[] }>(
      `/api/shadow/patterns?limit=${limit}`
    ),

  getGaps: (params?: { severity?: string; gap_type?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.severity) qs.set('severity', params.severity);
    if (params?.gap_type) qs.set('gap_type', params.gap_type);
    if (params?.page) qs.set('page', String(params.page));
    return apiClient.get<{ total: number; items: SyncGap[] }>(
      `/api/shadow/gaps?${qs.toString()}`
    );
  },

  getAiOpportunities: () =>
    apiClient.get<{ count: number; opportunities: AiOpportunity[] }>(
      '/api/shadow/ai-opportunities'
    ),

  getComparison: (entityType = 'order') =>
    apiClient.get<{
      entity_type: string;
      total_observed: number;
      match_rate: number;
      distribution: Record<string, number>;
      interpretation: string;
    }>(`/api/shadow/comparison?entity_type=${entityType}`),
};
