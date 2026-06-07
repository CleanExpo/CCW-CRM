import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import type {
  WorkflowInstance,
  WorkflowTemplate,
  WorkflowTemplateCreateInput,
  WorkflowTemplateUpdateInput,
} from '@/lib/api/workflows';

function serializeTemplate(row: {
  id: string;
  name: string;
  description: string | null;
  triggerEvent: string;
  triggerConditions: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  actions: Array<{
    id: string;
    templateId: string;
    actionType: string;
    actionConfig: unknown;
    sortOrder: number;
    createdAt: Date;
  }>;
}): WorkflowTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    trigger_event: row.triggerEvent,
    trigger_conditions: (row.triggerConditions as Record<string, unknown> | null) ?? null,
    is_active: row.isActive,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    actions: row.actions.map((a) => ({
      id: a.id,
      template_id: a.templateId,
      action_type: a.actionType,
      action_config: (a.actionConfig as Record<string, unknown> | null) ?? null,
      order: a.sortOrder,
      created_at: a.createdAt.toISOString(),
    })),
  };
}

function serializeInstance(row: {
  id: string;
  templateId: string | null;
  triggerEntityType: string;
  triggerEntityId: string | null;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  errorMessage: string | null;
}): WorkflowInstance {
  return {
    id: row.id,
    template_id: row.templateId,
    trigger_entity_type: row.triggerEntityType,
    trigger_entity_id: row.triggerEntityId,
    status: row.status,
    started_at: row.startedAt.toISOString(),
    completed_at: row.completedAt?.toISOString() ?? null,
    error_message: row.errorMessage,
  };
}

export async function listWorkflowTemplates(ownerUserId: string): Promise<WorkflowTemplate[]> {
  const rows = await prisma.workflowTemplate.findMany({
    where: { ownerUserId },
    include: { actions: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { updatedAt: 'desc' },
  });
  return rows.map(serializeTemplate);
}

export async function getWorkflowTemplate(
  ownerUserId: string,
  id: string
): Promise<WorkflowTemplate | null> {
  const row = await prisma.workflowTemplate.findFirst({
    where: { id, ownerUserId },
    include: { actions: { orderBy: { sortOrder: 'asc' } } },
  });
  return row ? serializeTemplate(row) : null;
}

export async function createWorkflowTemplate(
  ownerUserId: string,
  input: WorkflowTemplateCreateInput
): Promise<WorkflowTemplate> {
  const row = await prisma.workflowTemplate.create({
    data: {
      ownerUserId,
      name: input.name,
      description: input.description ?? null,
      triggerEvent: input.trigger_event,
      triggerConditions: input.trigger_conditions
        ? (input.trigger_conditions as Prisma.InputJsonValue)
        : Prisma.DbNull,
      isActive: input.is_active ?? true,
    },
    include: { actions: { orderBy: { sortOrder: 'asc' } } },
  });
  return serializeTemplate(row);
}

export async function updateWorkflowTemplate(
  ownerUserId: string,
  id: string,
  input: WorkflowTemplateUpdateInput
): Promise<WorkflowTemplate | null> {
  const existing = await prisma.workflowTemplate.findFirst({ where: { id, ownerUserId } });
  if (!existing) return null;
  const row = await prisma.workflowTemplate.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      triggerEvent: input.trigger_event,
      triggerConditions:
        input.trigger_conditions !== undefined
          ? input.trigger_conditions
            ? (input.trigger_conditions as Prisma.InputJsonValue)
            : Prisma.DbNull
          : undefined,
      isActive: input.is_active,
    },
    include: { actions: { orderBy: { sortOrder: 'asc' } } },
  });
  return serializeTemplate(row);
}

export async function deleteWorkflowTemplate(ownerUserId: string, id: string): Promise<boolean> {
  const existing = await prisma.workflowTemplate.findFirst({ where: { id, ownerUserId } });
  if (!existing) return false;
  await prisma.workflowTemplate.delete({ where: { id } });
  return true;
}

export async function listWorkflowInstances(
  ownerUserId: string,
  filters?: { template_id?: string; status?: string }
): Promise<WorkflowInstance[]> {
  const rows = await prisma.workflowInstance.findMany({
    where: {
      ownerUserId,
      ...(filters?.template_id ? { templateId: filters.template_id } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
    },
    orderBy: { startedAt: 'desc' },
    take: 100,
  });
  return rows.map(serializeInstance);
}
