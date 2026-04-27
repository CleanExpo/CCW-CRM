/**
 * In-memory automation workflow templates + instances when no API_UPSTREAM_URL is set.
 * Matches shapes from @/lib/api/workflows.
 */

import type {
  WorkflowInstance,
  WorkflowTemplate,
  WorkflowTemplateCreateInput,
  WorkflowTemplateUpdateInput,
} from '@/lib/api/workflows';

const templates = new Map<string, WorkflowTemplate>();
const instances: WorkflowInstance[] = [];

export function listTemplates(): WorkflowTemplate[] {
  return Array.from(templates.values()).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

export function getTemplate(id: string): WorkflowTemplate | undefined {
  return templates.get(id);
}

export function createTemplate(input: WorkflowTemplateCreateInput): WorkflowTemplate {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const row: WorkflowTemplate = {
    id,
    name: input.name,
    description: input.description ?? null,
    trigger_event: input.trigger_event,
    trigger_conditions: input.trigger_conditions ?? null,
    is_active: input.is_active ?? true,
    created_at: now,
    updated_at: now,
    actions: [],
  };
  templates.set(id, row);
  return row;
}

export function updateTemplate(
  id: string,
  input: WorkflowTemplateUpdateInput
): WorkflowTemplate | undefined {
  const prev = templates.get(id);
  if (!prev) return undefined;
  const now = new Date().toISOString();
  const next: WorkflowTemplate = {
    ...prev,
    ...input,
    description: input.description !== undefined ? input.description ?? null : prev.description,
    trigger_conditions:
      input.trigger_conditions !== undefined ? input.trigger_conditions ?? null : prev.trigger_conditions,
    updated_at: now,
  };
  templates.set(id, next);
  return next;
}

export function deleteTemplate(id: string): boolean {
  return templates.delete(id);
}

export function listInstances(filters?: { template_id?: string; status?: string }): WorkflowInstance[] {
  let rows = [...instances];
  if (filters?.template_id) {
    rows = rows.filter((i) => i.template_id === filters.template_id);
  }
  if (filters?.status) {
    rows = rows.filter((i) => i.status === filters.status);
  }
  return rows.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
}
