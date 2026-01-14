/**
 * Agent Autonomy TypeScript Types
 *
 * Corresponds to backend models in:
 * - apps/backend/src/ai/autonomy/models.py
 * - apps/backend/src/api/routes/autonomy.py
 */

export enum AutonomyLevel {
  ADVISORY = 'advisory',
  SEMI_AUTONOMOUS = 'semi_autonomous',
  FULLY_AUTONOMOUS = 'fully_autonomous',
}

export enum DecisionStatus {
  PENDING = 'pending',
  AUTO_EXECUTED = 'auto_executed',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export interface AgentAutonomyConfig {
  agent_id: string;
  autonomy_level: AutonomyLevel;
  enabled: boolean;

  // Confidence thresholds
  min_confidence_low_risk: number;
  min_confidence_medium_risk: number;
  min_confidence_high_risk: number;

  // Auto-approval limits
  max_auto_approval_amount: number;
  max_auto_approval_quantity: number;

  // Rate limiting
  max_actions_per_hour: number;
  max_actions_per_day: number;

  // Learning
  learning_enabled: boolean;

  // Notifications
  notify_on_execution: boolean;
  notify_on_pending: boolean;

  // Pause functionality
  pause_until?: string; // ISO datetime string

  // Metadata
  created_at: string;
  updated_at: string;
  updated_by?: string;
}

export interface AgentDecision {
  decision_id: string;
  agent_id: string;
  decision_type: string;

  // Decision data
  recommendation: any; // JSON object
  confidence: number;
  risk_level: RiskLevel;
  context?: any; // JSON object

  // Estimated impact
  estimated_value?: number;
  estimated_quantity?: number;

  // Status
  status: DecisionStatus;
  requires_approval: boolean;

  // Approval tracking
  approved_at?: string;
  approved_by?: string;
  rejected_at?: string;
  rejected_by?: string;
  rejection_reason?: string;

  // Execution tracking
  executed: boolean;
  executed_at?: string;
  execution_result?: any; // JSON object

  // Outcome tracking
  outcome_success?: boolean;
  outcome_metrics?: any; // JSON object
  outcome_feedback?: string;
  outcome_rating?: number; // 1-5

  // Timestamps
  created_at: string;
  expires_at?: string;
}

export interface AutonomyStats {
  agent_id: string;
  time_period: string;

  // Decision counts
  total_decisions: number;
  auto_executed: number;
  pending: number;
  approved: number;
  rejected: number;
  expired: number;

  // Execution tracking
  executed: number;
  success_count: number;
  failure_count: number;

  // Rates
  auto_execution_rate: number;
  approval_rate: number;
  success_rate: number;

  // Averages
  avg_confidence: number;
  avg_rating?: number;

  // Risk breakdown
  low_risk_count: number;
  medium_risk_count: number;
  high_risk_count: number;

  // Financial impact
  total_value: number;
  avg_value: number;
}

export interface AgentSummary {
  agent_id: string;
  agent_name: string;
  autonomy_level: AutonomyLevel;
  enabled: boolean;
  max_auto_approval_amount: number;
  max_actions_per_hour: number;
  max_actions_per_day: number;
}

export interface AgentListResponse {
  agents: AgentSummary[];
  total: number;
}

export interface ConfigUpdateRequest {
  autonomy_level?: AutonomyLevel;
  min_confidence_low_risk?: number;
  min_confidence_medium_risk?: number;
  min_confidence_high_risk?: number;
  max_auto_approval_amount?: number;
  max_auto_approval_quantity?: number;
  max_actions_per_hour?: number;
  max_actions_per_day?: number;
  learning_enabled?: boolean;
  notify_on_execution?: boolean;
  notify_on_pending?: boolean;
  enabled?: boolean;
  pause_until?: string;
}

export interface DecisionFilter {
  agent_id?: string;
  status?: DecisionStatus;
  risk_level?: RiskLevel;
  decision_type?: string;
  min_confidence?: number;
  page?: number;
  page_size?: number;
}

export interface DecisionListResponse {
  decisions: AgentDecision[];
  total: number;
  page: number;
  page_size: number;
}

export interface DecisionApprovalRequest {
  approved_by: string; // UUID
}

export interface DecisionRejectionRequest {
  rejected_by: string; // UUID
  reason: string;
}

export interface OutcomeRecordRequest {
  success: boolean;
  metrics?: any;
  feedback?: string;
  rating?: number; // 1-5
}

// Learning and Analysis Types

export interface ConfidenceAccuracy {
  count: number;
  avg_confidence: number;
  success_rate?: number;
}

export interface RiskAccuracy {
  count: number;
  avg_confidence: number;
  success_rate?: number;
  avg_value?: number;
}

export interface HumanOverridePattern {
  approved: number;
  rejected: number;
  approval_rate: number;
  common_rejection_reasons?: string[];
}

export interface ExecutionAnalysis {
  total_executed: number;
  successful: number;
  failed: number;
  success_rate: number;
  avg_rating?: number;
}

export interface DecisionBreakdown {
  total: number;
  auto_executed: number;
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
  auto_execution_rate: number;
  approval_rate: number;
}

export interface LearningAnalysis {
  agent_id: string;
  analysis_period_days: number;
  total_decisions: number;
  decision_breakdown: DecisionBreakdown;
  confidence_analysis: Record<string, ConfidenceAccuracy>;
  risk_analysis: Record<string, RiskAccuracy>;
  human_override_patterns: HumanOverridePattern;
  execution_analysis: ExecutionAnalysis;
}

export interface ThresholdRecommendation {
  type: 'confidence_threshold' | 'autonomy_level' | 'rate_limit';
  parameter: string;
  current_value: number | string;
  recommended_value: number | string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ThresholdRecommendations {
  agent_id: string;
  current_config: AgentAutonomyConfig;
  recommendations: ThresholdRecommendation[];
  analysis_period_days: number;
  total_decisions_analyzed: number;
}
