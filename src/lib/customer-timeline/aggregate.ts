import { prisma } from '@/lib/db/prisma';
import { ownerDataFilter, workspaceOwnerIds } from '@/lib/bank-reconciliation/scope';

export type TimelineEventType =
  | 'activity'
  | 'email'
  | 'invoice'
  | 'order'
  | 'quote'
  | 'payment'
  | 'operational';

export type UnifiedTimelineEvent = {
  id: string;
  event_type: TimelineEventType;
  occurred_at: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
};

export async function buildCustomerTimeline(
  customerId: string,
  userId: string,
  limit = 100
): Promise<UnifiedTimelineEvent[]> {
  const ownerIds = await workspaceOwnerIds(userId);

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, ...ownerDataFilter(ownerIds) },
    select: { id: true, email: true, companyName: true },
  });
  if (!customer) return [];

  const [activities, invoices, orders, quotes, emailThreads, operationalEvents] = await Promise.all([
    prisma.crmActivity.findMany({
      where: { customerId, ...ownerDataFilter(ownerIds) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.invoice.findMany({
      where: { customerId, ...ownerDataFilter(ownerIds) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { payments: true },
    }),
    prisma.order.findMany({
      where: { customerId, ...ownerDataFilter(ownerIds) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.quote.findMany({
      where: { customerId, ...ownerDataFilter(ownerIds) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.emailThread.findMany({
      where: {
        OR: [
          { customerId },
          customer.email
            ? { customerEmail: { equals: customer.email, mode: 'insensitive' } }
            : { id: '00000000-0000-0000-0000-000000000000' },
        ],
        ownerUserId: { in: ownerIds },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: limit,
    }),
    prisma.operationalEvent.findMany({
      where: { customerId, ...ownerDataFilter(ownerIds) },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    }),
  ]);

  const events: UnifiedTimelineEvent[] = [];

  for (const a of activities) {
    events.push({
      id: `activity-${a.id}`,
      event_type: 'activity',
      occurred_at: a.createdAt.toISOString(),
      title: a.subject,
      description: a.description,
      metadata: {
        activity_type: a.activityType,
        order_id: a.orderId,
        quote_id: a.quoteId,
        completed_at: a.completedAt?.toISOString() ?? null,
      },
    });
  }

  for (const inv of invoices) {
    events.push({
      id: `invoice-${inv.id}`,
      event_type: 'invoice',
      occurred_at: inv.createdAt.toISOString(),
      title: `Invoice ${inv.invoiceNumber}`,
      description: `Status: ${inv.status} — Total $${inv.total.toFixed(2)}`,
      metadata: {
        invoice_id: inv.id,
        status: inv.status,
        total: inv.total,
        amount_paid: inv.amountPaid,
      },
    });
    for (const p of inv.payments) {
      events.push({
        id: `payment-${p.id}`,
        event_type: 'payment',
        occurred_at: p.createdAt.toISOString(),
        title: `Payment on ${inv.invoiceNumber}`,
        description: `$${p.amount.toFixed(2)} via ${p.paymentMethod}`,
        metadata: {
          invoice_id: inv.id,
          amount: p.amount,
          reference: p.referenceNumber,
        },
      });
    }
  }

  for (const o of orders) {
    events.push({
      id: `order-${o.id}`,
      event_type: 'order',
      occurred_at: o.createdAt.toISOString(),
      title: `Order ${o.orderNumber}`,
      description: `Status: ${o.status} — Total $${o.total.toFixed(2)}`,
      metadata: { order_id: o.id, status: o.status, total: o.total },
    });
  }

  for (const q of quotes) {
    events.push({
      id: `quote-${q.id}`,
      event_type: 'quote',
      occurred_at: q.createdAt.toISOString(),
      title: `Quote ${q.quoteNumber}`,
      description: `Status: ${q.status} — Total $${(q.total ?? 0).toFixed(2)}`,
      metadata: { quote_id: q.id, status: q.status, total: q.total ?? 0 },
    });
  }

  for (const t of emailThreads) {
    events.push({
      id: `email-${t.id}`,
      event_type: 'email',
      occurred_at: t.lastMessageAt.toISOString(),
      title: t.subject,
      description: t.customerEmail,
      metadata: { thread_id: t.id, status: t.status, intent: t.intent },
    });
  }

  for (const op of operationalEvents) {
    events.push({
      id: `operational-${op.id}`,
      event_type: 'operational',
      occurred_at: op.occurredAt.toISOString(),
      title: op.title,
      description: op.description,
      metadata: {
        source: op.source,
        event_type: op.eventType,
        entity_type: op.entityType,
        entity_id: op.entityId,
        ...(typeof op.metadata === 'object' && op.metadata !== null
          ? (op.metadata as Record<string, unknown>)
          : {}),
      },
    });
  }

  return events
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, limit);
}
