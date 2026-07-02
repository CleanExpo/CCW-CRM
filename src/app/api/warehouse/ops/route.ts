import { NextRequest, NextResponse } from 'next/server';
import { format } from 'date-fns';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

// Returns/service and AI guidance have no backing data source yet. They are
// reported as not_connected with empty queues — never populated with demo data.
const SOURCES = {
  receiving: 'live',
  picks: 'live',
  returns: 'not_connected',
  aiGuidance: 'not_connected',
} as const;

function poToReceiving(
  po: {
    poNumber: string;
    deliveryLocation: string;
    status: string;
    expectedDeliveryDate: Date | null;
    supplier: { companyName: string };
    lines: { quantity: number }[];
  },
  idx: number,
) {
  const items = po.lines.reduce((s, l) => s + l.quantity, 0);
  const st = po.status.toLowerCase();
  const inProgress =
    st.includes('partial') || st.includes('transit') || st.includes('progress');
  return {
    id: po.poNumber,
    supplier: po.supplier.companyName,
    container: `${po.deliveryLocation.slice(0, 3).toUpperCase()}-${String(idx + 1).padStart(3, '0')}`,
    eta: po.expectedDeliveryDate
      ? format(po.expectedDeliveryDate, 'MMM d, yyyy')
      : 'Scheduled',
    dock: `Dock ${(idx % 3) + 1}`,
    items,
    status: inProgress ? 'in_progress' : 'scheduled',
    priority: items > 40 ? 'high' : 'normal',
  };
}

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  try {
    const inboundToday = await prisma.purchaseOrder.count({
      where: {
        ownerUserId: { in: workspaceUserIds },
        orderDate: { gte: startOfDay },
        NOT: { status: { in: ['cancelled', 'void'] } },
      },
    });

    const inboundPos = await prisma.purchaseOrder.findMany({
      where: {
        ownerUserId: { in: workspaceUserIds },
        NOT: { status: { in: ['cancelled', 'void', 'received', 'closed'] } },
      },
      take: 15,
      include: {
        supplier: { select: { companyName: true } },
        lines: { select: { quantity: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const receivingQueue = inboundPos.map((po, i) => poToReceiving(po, i));

    const openOrders = await prisma.order.findMany({
      where: {
        ownerUserId: { in: workspaceUserIds },
        NOT: { status: { in: ['completed', 'cancelled', 'delivered', 'draft'] } },
      },
      take: 15,
      include: {
        customer: { select: { companyName: true } },
        lineItems: { select: { id: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const pickQueue = openOrders.map((o) => ({
      id: o.orderNumber,
      customer: o.customer.companyName,
      zone: 'WH-OPS',
      lines: o.lineItems.length,
      promised: format(o.createdAt, 'MMM d, yyyy'),
      status: o.lineItems.length > 8 ? 'picking' : 'queued',
      priority: o.total > 5000 ? ('rush' as const) : ('normal' as const),
    }));

    const rushPicks = pickQueue.filter((p) => p.priority === 'rush').length;

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      sources: SOURCES,
      metrics: {
        inboundToday,
        inboundDocked: receivingQueue.filter((r) => r.status === 'in_progress').length,
        inboundScheduled: receivingQueue.filter((r) => r.status === 'scheduled').length,
        picksDueToday: pickQueue.length,
        rushPicks,
        returnsOpen: 0,
        returnSlaRisk: 0,
        // No on-time tracking exists yet; null means "not tracked", not 0%.
        onTimeRate: null,
      },
      receivingQueue,
      pickQueue,
      returnsQueue: [],
      aiGuidance: [],
    });
  } catch {
    return NextResponse.json(
      { detail: 'Warehouse operations data is currently unavailable.' },
      { status: 503 },
    );
  }
}
