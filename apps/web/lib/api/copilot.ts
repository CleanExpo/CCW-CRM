/**
 * Staff Copilot API client.
 *
 * Typed client for the AI Staff Copilot endpoints.
 */

import { apiClient } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CopilotMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CopilotQueryRequest {
  query: string;
  query_type?: 'general_query' | 'summarise_order' | 'summarise_customer' | 'suggest_next_action';
  module_context?: 'orders' | 'products' | 'customers' | 'inventory' | 'general';
  entity_id?: string;
  conversation_history?: CopilotMessage[];
}

export interface CopilotQueryResponse {
  answer: string;
  suggested_actions: string[];
  sources: string[];
  demo_mode: boolean;
  query_type: string;
}

export interface CopilotHealthResponse {
  status: string;
  agent_id: string;
  capabilities: string[];
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const copilotApi = {
  /** Send a query to the staff copilot */
  query: (data: CopilotQueryRequest): Promise<CopilotQueryResponse> =>
    apiClient.post<CopilotQueryResponse>('/api/ai/copilot/query', data),

  /** Check the health of the staff copilot agent */
  health: (): Promise<CopilotHealthResponse> =>
    apiClient.get<CopilotHealthResponse>('/api/ai/copilot/health'),
};
