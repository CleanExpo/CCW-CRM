import { prisma } from '@/lib/db/prisma';
import { logOperationalEvent } from '@/lib/comms/operational-events';
import { createInAppNotification, notifyWorkspaceMembers } from '@/lib/workflows/notifications';
import {
  getSendGridSendReadiness,
  resolveSendGridFromEmail,
  sendMailViaSendGrid,
} from '@/lib/integrations/sendgrid-mail';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

export type WorkflowTriggerContext = {
  ownerUserId: string;
  triggerEntityType: string;
  triggerEntityId?: string;
  customerId?: string | null;
  customerEmail?: string | null;
  payload?: Record<string, unknown>;
};

type ActionConfig = Record<string, unknown>;

async function executeAction(
  actionType: string,
  config: ActionConfig | null,
  ctx: WorkflowTriggerContext
) {
  const cfg = config ?? {};
  switch (actionType) {
    case 'send_email': {
      const to = String(cfg.to_email ?? ctx.customerEmail ?? '').trim();
      const subject = String(cfg.subject ?? 'Notification from Optix');
      const body = String(cfg.body ?? cfg.body_text ?? 'An event occurred in Optix.');
      if (!to) return;
      const readiness = await getSendGridSendReadiness(undefined, ctx.ownerUserId);
      if (!readiness.ok || !readiness.creds.apiKey) return;
      const fromEmail = resolveSendGridFromEmail(undefined, readiness.creds);
      if (!fromEmail) return;
      await sendMailViaSendGrid(readiness.creds.apiKey, fromEmail, readiness.creds.fromName, {
        to_email: to,
        subject,
        body_text: body,
      });
      await logOperationalEvent({
        ownerUserId: ctx.ownerUserId,
        customerId: ctx.customerId,
        eventType: 'email',
        source: 'workflow',
        title: subject,
        description: to,
        entityType: ctx.triggerEntityType,
        entityId: ctx.triggerEntityId ?? null,
      });
      break;
    }
    case 'create_in_app_notification':
      await notifyWorkspaceMembers({
        actorUserId: ctx.ownerUserId,
        title: String(cfg.title ?? 'Workflow alert'),
        message: String(cfg.message ?? 'A workflow action ran.'),
        notificationType: String(cfg.notification_type ?? 'workflow'),
        entityType: ctx.triggerEntityType,
        entityId: ctx.triggerEntityId,
      });
      break;
    case 'create_task':
      await prisma.crmActivity.create({
        data: {
          ownerUserId: ctx.ownerUserId,
          activityType: 'task',
          subject: String(cfg.title ?? 'Follow up'),
          description: cfg.description ? String(cfg.description) : null,
          customerId: ctx.customerId ?? null,
          dueDate: cfg.due_hours
            ? new Date(Date.now() + Number(cfg.due_hours) * 3600000)
            : null,
        },
      });
      break;
    case 'log_timeline':
    default:
      await logOperationalEvent({
        ownerUserId: ctx.ownerUserId,
        customerId: ctx.customerId,
        eventType: String(cfg.event_type ?? ctx.triggerEntityType),
        source: 'workflow',
        title: String(cfg.title ?? 'Operational update'),
        description: cfg.description ? String(cfg.description) : null,
        entityType: ctx.triggerEntityType,
        entityId: ctx.triggerEntityId ?? null,
        metadata: ctx.payload ?? {},
      });
      break;
  }
}

async function runTemplateActions(
  template: {
    id: string;
    actions: Array<{
      actionType: string;
      actionConfig: unknown;
    }>;
  },
  ctx: WorkflowTriggerContext
) {
  const instance = await prisma.workflowInstance.create({
    data: {
      ownerUserId: ctx.ownerUserId,
      templateId: template.id,
      triggerEntityType: ctx.triggerEntityType,
      triggerEntityId: ctx.triggerEntityId ?? null,
      status: 'running',
    },
  });

  try {
    for (const action of template.actions) {
      await executeAction(
        action.actionType,
        (action.actionConfig as ActionConfig | null) ?? null,
        ctx
      );
    }
    await prisma.workflowInstance.update({
      where: { id: instance.id },
      data: { status: 'completed', completedAt: new Date() },
    });
  } catch (e) {
    await prisma.workflowInstance.update({
      where: { id: instance.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: e instanceof Error ? e.message : String(e),
      },
    });
  }

  return instance.id;
}

export async function dispatchWorkflowTemplate(
  templateId: string,
  ctx: WorkflowTriggerContext
): Promise<{ instance_id: string | null }> {
  const template = await prisma.workflowTemplate.findFirst({
    where: { id: templateId, ownerUserId: ctx.ownerUserId, isActive: true },
    include: { actions: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!template) return { instance_id: null };
  const instanceId = await runTemplateActions(template, ctx);
  return { instance_id: instanceId };
}

export async function createSlaInstanceForEntity(
  ownerUserId: string,
  entityType: string,
  entityId: string
) {
  const rule = await prisma.sLARule.findFirst({
    where: { ownerUserId, entityType, isActive: true },
  });
  if (!rule) return null;
  return prisma.sLAInstance.create({
    data: {
      slaRuleId: rule.id,
      entityId,
      entityType,
      deadline: new Date(Date.now() + rule.slaHours * 3600000),
    },
  });
}

export async function dispatchWorkflowTrigger(
  triggerEvent: string,
  ctx: WorkflowTriggerContext
): Promise<{ instances: number }> {
  const ownerIds = await getWorkspaceMemberUserIds(ctx.ownerUserId);
  const templates = await prisma.workflowTemplate.findMany({
    where: {
      ownerUserId: { in: ownerIds },
      triggerEvent,
      isActive: true,
    },
    include: { actions: { orderBy: { sortOrder: 'asc' } } },
  });

  let instances = 0;
  for (const template of templates) {
    await runTemplateActions(template, ctx);
    instances++;
  }

  return { instances };
}

export async function ensureDefaultWorkflowTemplates(ownerUserId: string) {
  const existing = await prisma.workflowTemplate.count({ where: { ownerUserId } });
  if (existing > 0) return;

  const invoiceOverdue = await prisma.workflowTemplate.create({
    data: {
      ownerUserId,
      name: 'Invoice overdue reminder',
      description: 'Email customer and notify account manager when invoice is overdue',
      triggerEvent: 'invoice_overdue',
      isActive: true,
      actions: {
        create: [
          {
            actionType: 'send_email',
            sortOrder: 0,
            actionConfig: {
              subject: 'Invoice overdue reminder',
              body: 'Your invoice is overdue. Please contact us to arrange payment.',
            },
          },
          {
            actionType: 'create_in_app_notification',
            sortOrder: 1,
            actionConfig: {
              title: 'Invoice overdue',
              message: 'An invoice requires follow-up.',
              notification_type: 'invoice_overdue',
            },
          },
          {
            actionType: 'log_timeline',
            sortOrder: 2,
            actionConfig: {
              title: 'Invoice overdue workflow ran',
              event_type: 'invoice',
            },
          },
        ],
      },
    },
  });

  await prisma.sLARule.create({
    data: {
      ownerUserId,
      name: 'Approval response SLA',
      entityType: 'approval',
      slaHours: 24,
      escalationAction: 'notify',
      isActive: true,
    },
  });

  void invoiceOverdue;

  await prisma.workflowTemplate.create({
    data: {
      ownerUserId,
      name: 'New order notification',
      description: 'Notify team when a new order is created',
      triggerEvent: 'order_created',
      isActive: true,
      actions: {
        create: [
          {
            actionType: 'create_in_app_notification',
            sortOrder: 0,
            actionConfig: {
              title: 'New order',
              message: 'A new order was created and may need fulfilment.',
              notification_type: 'order_created',
            },
          },
          {
            actionType: 'log_timeline',
            sortOrder: 1,
            actionConfig: {
              title: 'Order created',
              event_type: 'order',
            },
          },
        ],
      },
    },
  });

  await prisma.workflowTemplate.create({
    data: {
      ownerUserId,
      name: 'Invoice sent confirmation',
      description: 'Log timeline entry when invoice is sent to customer',
      triggerEvent: 'invoice_sent',
      isActive: true,
      actions: {
        create: [
          {
            actionType: 'log_timeline',
            sortOrder: 0,
            actionConfig: {
              title: 'Invoice sent to customer',
              event_type: 'invoice',
            },
          },
        ],
      },
    },
  });

  await prisma.workflowTemplate.create({
    data: {
      ownerUserId,
      name: 'Trade finance advance overdue',
      description: 'Notify finance when a trade finance advance is overdue',
      triggerEvent: 'advance_overdue',
      isActive: true,
      actions: {
        create: [
          {
            actionType: 'create_in_app_notification',
            sortOrder: 0,
            actionConfig: {
              title: 'Advance overdue',
              message: 'A trade finance advance requires repayment follow-up.',
              notification_type: 'advance_overdue',
            },
          },
          {
            actionType: 'log_timeline',
            sortOrder: 1,
            actionConfig: {
              title: 'Trade finance advance overdue',
              event_type: 'trade_finance',
            },
          },
        ],
      },
    },
  });
}

export async function checkSlaBreaches(ownerUserId: string) {
  const ownerIds = await getWorkspaceMemberUserIds(ownerUserId);
  const now = new Date();
  const due = await prisma.sLAInstance.findMany({
    where: {
      breached: false,
      deadline: { lt: now },
      rule: { ownerUserId: { in: ownerIds }, isActive: true },
    },
    include: { rule: true },
  });

  let escalations = 0;
  for (const inst of due) {
    await prisma.sLAInstance.update({
      where: { id: inst.id },
      data: { breached: true, breachNotified: true },
    });
    await notifyWorkspaceMembers({
      actorUserId: ownerUserId,
      title: 'SLA breached',
      message: `${inst.rule.name} — deadline passed for ${inst.entityType}`,
      notificationType: 'sla_breach',
      entityType: inst.entityType,
      entityId: inst.entityId,
    });
    escalations++;
  }
  return { breaches_found: due.length, escalations_sent: escalations };
}
