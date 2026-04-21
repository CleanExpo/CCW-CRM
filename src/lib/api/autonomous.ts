/**
 * Autonomous Execution API Client
 *
 * Provides methods for interacting with autonomous execution workflows.
 */

import { apiClient } from './client';
import { getAppOrigin } from '@/lib/api/backend-url';

/**
 * Task state status
 */
export type TaskStatus = 'pending' | 'in_progress' | 'paused' | 'completed' | 'failed';

/**
 * Approval gate status
 */
export type GateStatus = 'pending' | 'approved' | 'rejected';

/**
 * Single approval gate
 */
export interface ApprovalGate {
  gate_id: number;
  phase: number;
  name: string;
  status: GateStatus;
  approved_at: string | null;
  approved_by: string | null;
  feedback: string | null;
}

/**
 * Task metadata
 */
export interface TaskMetadata {
  estimated_total_time_minutes: number;
  elapsed_time_minutes: number;
  files_to_create: number;
  files_to_modify: number;
  files_created?: string[];
  files_modified?: string[];
}

/**
 * Complete task state
 */
export interface TaskState {
  task_id: string;
  created_at: string;
  user_request: string;
  current_phase: number;
  current_agent: string;
  status: TaskStatus;
  approval_mode: 'manual' | 'auto';
  phases_completed: number[];
  phases_remaining: number[];
  approval_gates: ApprovalGate[];
  metadata: TaskMetadata;
  error?: {
    phase: number;
    agent: string;
    message: string;
    timestamp: string;
  };
}

/**
 * SSE event from autonomous execution
 */
export interface AutonomousEvent {
  timestamp: string;
  event: string;
  task_id: string;
  phase?: number;
  agent?: string;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Start autonomous execution request
 */
export interface StartAutonomousRequest {
  task_description: string;
  approval_mode?: 'manual' | 'auto';
  build_task_id?: string;
}

/**
 * Start autonomous execution response
 */
export interface StartAutonomousResponse {
  task_id: string;
  status: string;
  message: string;
}

/**
 * Get task status response
 */
export interface GetTaskStatusResponse {
  task_id: string;
  exists: boolean;
  state: TaskState | null;
}

/**
 * Approve gate request
 */
export interface ApproveGateRequest {
  gate_id: number;
  approved_by?: string;
}

/**
 * Reject gate request
 */
export interface RejectGateRequest {
  gate_id: number;
  feedback: string;
  rejected_by?: string;
}

/**
 * Approve gate response
 */
export interface ApproveGateResponse {
  task_id: string;
  gate_id: number;
  status: 'approved';
  message: string;
  next_action: string;
}

/**
 * Reject gate response
 */
export interface RejectGateResponse {
  task_id: string;
  gate_id: number;
  status: 'rejected';
  message: string;
  next_action: string;
}

/**
 * List gates response
 */
export interface ListGatesResponse {
  task_id: string;
  gates: ApprovalGate[];
  current_gate: number | null;
}

/**
 * Autonomous execution API client
 */
export const autonomousApi = {
  /**
   * Start autonomous execution
   */
  async startExecution(request: StartAutonomousRequest): Promise<StartAutonomousResponse> {
    return apiClient.post('/api/ai/autonomous/start', request);
  },

  /**
   * Get task status
   */
  async getTaskStatus(taskId: string): Promise<GetTaskStatusResponse> {
    return apiClient.get(`/api/ai/autonomous/status/${taskId}`);
  },

  /**
   * Pause task
   */
  async pauseTask(taskId: string): Promise<{ message: string }> {
    return apiClient.post(`/api/ai/autonomous/${taskId}/pause`, {});
  },

  /**
   * Resume task
   */
  async resumeTask(taskId: string): Promise<{ message: string }> {
    return apiClient.post(`/api/ai/autonomous/${taskId}/resume`, {});
  },

  /**
   * Cancel task
   */
  async cancelTask(taskId: string): Promise<{ message: string }> {
    return apiClient.post(`/api/ai/autonomous/${taskId}/cancel`, {});
  },

  /**
   * Approve approval gate
   */
  async approveGate(taskId: string, request: ApproveGateRequest): Promise<ApproveGateResponse> {
    return apiClient.post(`/api/ai/autonomous/gates/${taskId}/approve`, request);
  },

  /**
   * Reject approval gate
   */
  async rejectGate(taskId: string, request: RejectGateRequest): Promise<RejectGateResponse> {
    return apiClient.post(`/api/ai/autonomous/gates/${taskId}/reject`, request);
  },

  /**
   * List approval gates
   */
  async listGates(taskId: string): Promise<ListGatesResponse> {
    return apiClient.get(`/api/ai/autonomous/gates/${taskId}`);
  },

  /**
   * Subscribe to task events via Server-Sent Events
   */
  subscribeToEvents(taskId: string, onEvent: (event: AutonomousEvent) => void): EventSource {
    const eventSource = new EventSource(
      `${getAppOrigin()}/api/ai/autonomous/stream/${taskId}`
    );

    eventSource.onmessage = (e) => {
      try {
        const event: AutonomousEvent = JSON.parse(e.data);
        onEvent(event);
      } catch (error) {
        console.error('Failed to parse SSE event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      eventSource.close();
    };

    return eventSource;
  },
};
