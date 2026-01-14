/**
 * TypeScript types for visual workflows (frontend)
 */

export type NodeType =
  | "start"
  | "end"
  | "llm"
  | "agent"
  | "tool"
  | "conditional"
  | "loop"
  | "knowledge"
  | "http"
  | "code"
  | "verification";

export type EdgeType = "default" | "true" | "false" | "success" | "error" | "item";

export interface NodePosition {
  x: number;
  y: number;
}

export interface NodeConfig {
  id: string;
  type: NodeType;
  position: NodePosition;
  label: string;
  description?: string;
  config: Record<string, any>;
  inputs: Record<string, string>;
  outputs: Record<string, string>;
  metadata: Record<string, any>;
}

export interface WorkflowEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle?: string;
  target_handle?: string;
  type: EdgeType;
  condition?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: string;
  nodes: NodeConfig[];
  edges: WorkflowEdge[];
  variables: Record<string, any>;
  skill_compatibility: string[];
  created_at: string;
  updated_at: string;
  created_by?: string;
  tags: string[];
  is_published: boolean;
}

export type ExecutionStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface WorkflowExecution {
  execution_id: string;
  workflow_id: string;
  status: ExecutionStatus;
  started_at: string;
  completed_at?: string;
  current_node_id?: string;
  completed_nodes: string[];
  failed_nodes: string[];
}
