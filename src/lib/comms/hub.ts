import { prisma } from '@/lib/db/prisma';
import { ownerDataFilter, workspaceOwnerIds } from '@/lib/bank-reconciliation/scope';

export type CommsHubEvent = {
  id: string;
  kind: 'operational' | 'email' | 'notification';
  occurred_at: string;
  title: string;
  description: string | null;
  customer_id: string | null;
  customer_name: string | null;
  source: string;
  metadata: Record<string, unknown>;
};

export type CommsHubSummary = {
  open_email_threads: number;
  unread_notifications: number;
  pending_approvals: number;
  recent_events_count: number;
};

export async function buildCommsHub(
  userId: string,
  limit = 50
): Promise<{ summary: CommsHubSummary; events: CommsHubEvent[] }> {
  const ownerIds = await workspaceOwnerIds(userId);

  const [openThreads, unreadNotifications, pendingApprovals, operationalEvents, emailThreads, notifications] =
    await Promise.all([
      prisma.emailThread.count({
        where: { ownerUserId: { in: ownerIds }, status: { in: ['open', 'pending'] } },
      }),
      prisma.inAppNotification.count({
        where: { userId, isRead: false },
      }),
      prisma.approval.count({
        where: { ownerUserId: { in: ownerIds }, status: 'pending' },
      }),
      prisma.operationalEvent.findMany({
        where: ownerDataFilter(ownerIds),
        orderBy: { occurredAt: 'desc' },
        take: limit,
        include: {
          customer: { select: { id: true, companyName: true } },
        },
      }),
      prisma.emailThread.findMany({
        where: { ownerUserId: { in: ownerIds } },
        orderBy: { lastMessageAt: 'desc' },
        take: limit,
        include: {
          customer: { select: { id: true, companyName: true } },
        },
      }),
      prisma.inAppNotification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

  const events: CommsHubEvent[] = [];

  for (const op of operationalEvents) {
    events.push({
      id: `operational-${op.id}`,
      kind: 'operational',
      occurred_at: op.occurredAt.toISOString(),
      title: op.title,
      description: op.description,
      customer_id: op.customerId,
      customer_name: op.customer?.companyName ?? null,
      source: op.source,
      metadata: {
        event_type: op.eventType,
        entity_type: op.entityType,
        entity_id: op.entityId,
        ...(typeof op.metadata === 'object' && op.metadata !== null
          ? (op.metadata as Record<string, unknown>)
          : {}),
      },
    });
  }

  for (const thread of emailThreads) {
    events.push({
      id: `email-${thread.id}`,
      kind: 'email',
      occurred_at: thread.lastMessageAt.toISOString(),
      title: thread.subject,
      description: thread.customerEmail,
      customer_id: thread.customerId,
      customer_name: thread.customer?.companyName ?? thread.customerName,
      source: 'sendgrid',
      metadata: { thread_id: thread.id, status: thread.status, intent: thread.intent },
    });
  }

  for (const n of notifications) {
    events.push({
      id: `notification-${n.id}`,
      kind: 'notification',
      occurred_at: n.createdAt.toISOString(),
      title: n.title,
      description: n.message,
      customer_id: null,
      customer_name: null,
      source: 'system',
      metadata: {
        notification_type: n.notificationType,
        entity_type: n.entityType,
        entity_id: n.entityId,
        is_read: n.isRead,
      },
    });
  }

  const sorted = events
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, limit);

  return {
    summary: {
      open_email_threads: openThreads,
      unread_notifications: unreadNotifications,
      pending_approvals: pendingApprovals,
      recent_events_count: sorted.length,
    },
    events: sorted,
  };
}
