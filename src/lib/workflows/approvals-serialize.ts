import type { Approval, ApprovalStep } from '@/lib/api/approvals';

export function serializeApproval(row: {
  id: string;
  approvalType: string;
  entityId: string;
  entityType: string;
  status: string;
  totalSteps: number;
  currentStep: number;
  requestedBy: string;
  notes: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  steps: Array<{
    id: string;
    stepNumber: number;
    approverId: string;
    approverRole: string | null;
    status: string;
    comments: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
  }>;
}): Approval {
  return {
    id: row.id,
    approval_type: row.approvalType,
    entity_id: row.entityId,
    entity_type: row.entityType,
    status: row.status,
    total_steps: row.totalSteps,
    current_step: row.currentStep,
    requested_by: row.requestedBy,
    notes: row.notes,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    completed_at: row.completedAt?.toISOString() ?? null,
    steps: row.steps.map(serializeStep),
  };
}

export function serializeStep(row: {
  id: string;
  stepNumber: number;
  approverId: string;
  approverRole: string | null;
  status: string;
  comments: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}): ApprovalStep {
  return {
    id: row.id,
    step_number: row.stepNumber,
    approver_id: row.approverId,
    approver_role: row.approverRole,
    status: row.status,
    comments: row.comments,
    created_at: row.createdAt.toISOString(),
    reviewed_at: row.reviewedAt?.toISOString() ?? null,
  };
}
