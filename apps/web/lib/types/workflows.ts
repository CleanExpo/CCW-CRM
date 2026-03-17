/**
 * Workflow Automation TypeScript Types
 * Mirrors backend Pydantic schemas from apps/backend/src/db/workflow_models.py
 */

export enum WorkflowStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum SLAStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  MET = 'met',
  BREACHED = 'breached',
  ESCALATED = 'escalated',
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  trigger_event: string;
  trigger_conditions?: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowTemplateAction {
  id: string;
  template_id: string;
  action_type: string;
  action_config?: Record<string, any>;
  order: number;
  created_at: string;
}

export interface WorkflowInstance {
  id: string;
  template_id?: string;
  trigger_entity_type: string;
  trigger_entity_id?: string;
  status: WorkflowStatus;
  started_at: string;
  completed_at?: string;
  error_message?: string;
}

export interface SLARule {
  id: string;
  name: string;
  entity_type: string;
  sla_hours: number;
  escalation_action: string;
  escalation_config?: Record<string, any>;
  is_active: boolean;
  created_at: string;
}

export interface SLAInstance {
  id: string;
  rule_id?: string;
  entity_type: string;
  entity_id: string;
  status: SLAStatus;
  deadline: string;
  breached_at?: string;
  escalated_at?: string;
  escalation_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  notification_type: string;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

// Request Types

export interface CreateWorkflowTemplateRequest {
  name: string;
  description?: string;
  trigger_event: string;
  trigger_conditions?: Record<string, any>;
  is_active?: boolean;
  actions?: CreateWorkflowActionRequest[];
}

export interface CreateWorkflowActionRequest {
  action_type: string;
  action_config?: Record<string, any>;
  order: number;
}

export interface CreateSLARuleRequest {
  name: string;
  entity_type: string;
  sla_hours: number;
  escalation_action: string;
  escalation_config?: Record<string, any>;
  is_active?: boolean;
}

export interface SLAEscalationPayload {
  sla_instance_id: string;
  escalation_notes?: string;
  escalation_action?: string;
  notify_users?: string[];
}

export interface CreateNotificationRequest {
  user_id: string;
  notification_type: string;
  title: string;
  message: string;
  link?: string;
}

// Response Types

export interface PaginatedWorkflowTemplatesResponse {
  items: WorkflowTemplate[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PaginatedWorkflowInstancesResponse {
  items: WorkflowInstance[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PaginatedSLAInstancesResponse {
  items: SLAInstance[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PaginatedNotificationsResponse {
  items: Notification[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  unread_count: number;
}
