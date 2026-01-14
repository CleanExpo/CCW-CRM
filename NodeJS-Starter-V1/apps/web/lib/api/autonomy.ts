/**
 * Agent Autonomy API Client
 *
 * Provides methods for interacting with the agent autonomy management system.
 * All methods are async and handle authentication via apiClient.
 */

import { apiClient } from './client';
import type {
  AgentListResponse,
  AgentAutonomyConfig,
  ConfigUpdateRequest,
  DecisionListResponse,
  DecisionFilter,
  AgentDecision,
  DecisionApprovalRequest,
  DecisionRejectionRequest,
  OutcomeRecordRequest,
  AutonomyStats,
  LearningAnalysis,
  ThresholdRecommendations,
} from '@/lib/types/autonomy';

/**
 * List all agents with their autonomy configurations
 */
export async function listAgents(): Promise<AgentListResponse> {
  const response = await apiClient.get<AgentListResponse>('/api/autonomy/agents');
  return response.data;
}

/**
 * Get autonomy configuration for a specific agent
 */
export async function getAgentConfig(agentId: string): Promise<AgentAutonomyConfig> {
  const response = await apiClient.get<AgentAutonomyConfig>(
    `/api/autonomy/config/${agentId}`
  );
  return response.data;
}

/**
 * Update autonomy configuration for an agent
 */
export async function updateAgentConfig(
  agentId: string,
  updates: ConfigUpdateRequest,
  updatedBy?: string
): Promise<AgentAutonomyConfig> {
  const response = await apiClient.put<AgentAutonomyConfig>(
    `/api/autonomy/config/${agentId}`,
    updates,
    {
      params: updatedBy ? { updated_by: updatedBy } : undefined,
    }
  );
  return response.data;
}

/**
 * Query agent decisions with filters
 */
export async function queryDecisions(
  filter: DecisionFilter = {}
): Promise<DecisionListResponse> {
  const {
    agent_id,
    status,
    risk_level,
    decision_type,
    min_confidence,
    page = 1,
    page_size = 20,
  } = filter;

  const params = new URLSearchParams();
  if (agent_id) params.append('agent_id', agent_id);
  if (status) params.append('status', status);
  if (risk_level) params.append('risk_level', risk_level);
  if (decision_type) params.append('decision_type', decision_type);
  if (min_confidence !== undefined) params.append('min_confidence', String(min_confidence));
  params.append('page', String(page));
  params.append('page_size', String(page_size));

  const response = await apiClient.get<DecisionListResponse>(
    `/api/autonomy/decisions?${params.toString()}`
  );
  return response.data;
}

/**
 * Get decisions pending approval
 */
export async function getPendingDecisions(
  agentId?: string,
  limit: number = 100
): Promise<AgentDecision[]> {
  const params = new URLSearchParams();
  if (agentId) params.append('agent_id', agentId);
  params.append('limit', String(limit));

  const response = await apiClient.get<AgentDecision[]>(
    `/api/autonomy/decisions/pending?${params.toString()}`
  );
  return response.data;
}

/**
 * Approve a pending decision
 */
export async function approveDecision(
  decisionId: string,
  approvedBy: string
): Promise<AgentDecision> {
  const request: DecisionApprovalRequest = { approved_by: approvedBy };
  const response = await apiClient.post<AgentDecision>(
    `/api/autonomy/decisions/${decisionId}/approve`,
    request
  );
  return response.data;
}

/**
 * Reject a pending decision
 */
export async function rejectDecision(
  decisionId: string,
  rejectedBy: string,
  reason: string
): Promise<AgentDecision> {
  const request: DecisionRejectionRequest = { rejected_by: rejectedBy, reason };
  const response = await apiClient.post<AgentDecision>(
    `/api/autonomy/decisions/${decisionId}/reject`,
    request
  );
  return response.data;
}

/**
 * Get performance statistics for an agent
 */
export async function getAgentStats(
  agentId: string,
  timePeriod: 'last_24h' | 'last_7d' | 'last_30d' = 'last_7d'
): Promise<AutonomyStats> {
  const response = await apiClient.get<AutonomyStats>(
    `/api/autonomy/stats/${agentId}`,
    {
      params: { time_period: timePeriod },
    }
  );
  return response.data;
}

/**
 * Record outcome and feedback for a decision
 */
export async function recordDecisionOutcome(
  decisionId: string,
  outcome: OutcomeRecordRequest
): Promise<AgentDecision> {
  const response = await apiClient.post<AgentDecision>(
    `/api/autonomy/decisions/${decisionId}/outcome`,
    outcome
  );
  return response.data;
}

/**
 * Get learning analysis for an agent
 */
export async function getLearningAnalysis(
  agentId: string,
  days: number = 30
): Promise<LearningAnalysis> {
  const response = await apiClient.get<LearningAnalysis>(
    `/api/autonomy/learning/analysis/${agentId}`,
    {
      params: { days },
    }
  );
  return response.data;
}

/**
 * Get threshold adjustment recommendations for an agent
 */
export async function getThresholdRecommendations(
  agentId: string,
  days: number = 30
): Promise<ThresholdRecommendations> {
  const response = await apiClient.get<ThresholdRecommendations>(
    `/api/autonomy/learning/recommendations/${agentId}`,
    {
      params: { days },
    }
  );
  return response.data;
}

/**
 * Utility function to format confidence as percentage
 */
export function formatConfidence(confidence: number): string {
  return `${(confidence * 100).toFixed(0)}%`;
}

/**
 * Utility function to get risk level color
 */
export function getRiskColor(riskLevel: string): string {
  switch (riskLevel.toLowerCase()) {
    case 'low':
      return 'text-green-600 dark:text-green-400';
    case 'medium':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'high':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}

/**
 * Utility function to get risk level badge variant
 */
export function getRiskBadgeVariant(
  riskLevel: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (riskLevel.toLowerCase()) {
    case 'low':
      return 'secondary';
    case 'medium':
      return 'default';
    case 'high':
      return 'destructive';
    default:
      return 'outline';
  }
}

/**
 * Utility function to get decision status color
 */
export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'auto_executed':
      return 'text-green-600 dark:text-green-400';
    case 'approved':
      return 'text-blue-600 dark:text-blue-400';
    case 'pending':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'rejected':
      return 'text-red-600 dark:text-red-400';
    case 'expired':
      return 'text-gray-600 dark:text-gray-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}

/**
 * Utility function to get decision status badge variant
 */
export function getStatusBadgeVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status.toLowerCase()) {
    case 'auto_executed':
      return 'secondary';
    case 'approved':
      return 'default';
    case 'pending':
      return 'outline';
    case 'rejected':
      return 'destructive';
    case 'expired':
      return 'outline';
    default:
      return 'outline';
  }
}

/**
 * Utility function to format autonomy level for display
 */
export function formatAutonomyLevel(level: string): string {
  switch (level) {
    case 'advisory':
      return 'Advisory';
    case 'semi_autonomous':
      return 'Semi-Autonomous';
    case 'fully_autonomous':
      return 'Fully Autonomous';
    default:
      return level;
  }
}
