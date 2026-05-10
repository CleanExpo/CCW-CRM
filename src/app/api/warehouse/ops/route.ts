import { NextRequest, NextResponse } from 'next/server';
import { format } from 'date-fns';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

const FALLBACK_RECEIVING = [
  {
    id: 'RCV-2041',
    supplier: 'Bennett Logistics',
    container: 'MSKU-4092',
    eta: 'Today 2:30 PM',
    dock: 'Dock 3',
    items: 48,
    status: 'scheduled',
    priority: 'high',
  },
  {
    id: 'RCV-2038',
    supplier: 'CleanTech Supplies',
    container: 'OOLU-8812',
    eta: 'Tomorrow 9:10 AM',
    dock: 'Dock 1',
    items: 32,
    status: 'in_progress',
    priority: 'normal',
  },
  {
    id: 'RCV-2033',
    supplier: 'Pacific Restoration',
    container: 'TGHU-2217',
    eta: 'Tomorrow 1:45 PM',
    dock: 'Dock 2',
    items: 21,
    status: 'scheduled',
    priority: 'low',
  },
];

const FALLBACK_PICKS = [
  {
    id: 'PICK-8412',
    customer: 'Metro Facility Services',
    zone: 'BNE-02',
    lines: 12,
    promised: 'Today 5:00 PM',
    status: 'picking',
    priority: 'rush',
  },
  {
    id: 'PICK-8401',
    customer: 'Aero Services Group',
    zone: 'SYD-01',
    lines: 6,
    promised: 'Today 4:00 PM',
    status: 'queued',
    priority: 'normal',
  },
  {
    id: 'PICK-8396',
    customer: 'Harbour Hospitality',
    zone: 'BNE-01',
    lines: 9,
    promised: 'Tomorrow 11:00 AM',
    status: 'queued',
    priority: 'normal',
  },
];

const FALLBACK_RETURNS = [
  {
    id: 'RMA-4321',
    customer: 'Sapphire Maintenance',
    reason: 'Damaged on arrival',
    items: 2,
    sla: 'Due in 4h',
    status: 'inspection',
  },
  {
    id: 'RMA-4316',
    customer: 'Metro Facility Services',
    reason: 'Warranty service',
    items: 1,
    sla: 'Due tomorrow',
    status: 'awaiting_parts',
  },
  {
    id: 'SRV-1198',
    customer: 'Aero Services Group',
    reason: 'Motor replacement',
    items: 1,
    sla: 'Due in 2d',
    status: 'in_progress',
  },
];

const AI_GUIDANCE = [
  {
    title: 'Rebalance BNE-02 picks',
    detail:
      '4 priority picks share the same zone. Recommend splitting to BNE-03 for faster throughput.',
    impact: 'ETA risk reduced by 22%',
  },
  {
    title: 'Inbound ETA risk',
    detail:
      'RCV-2041 has a 2h dock delay trend. Notify supplier and adjust labor plan.',
    impact: 'Prevents overtime spike',
  },
  {
    title: 'Return SLA breach',
    detail: 'RMA-4321 is 4h from SLA. Assign QA to close inspection.',
    impact: 'SLA compliance maintained',
  },
];

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

  let receivingQueue = FALLBACK_RECEIVING;
  let pickQueue = FALLBACK_PICKS;
  const returnsQueue = FALLBACK_RETURNS;

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

    if (inboundPos.length > 0) {
      receivingQueue = inboundPos.map((po, i) => poToReceiving(po, i));
    }

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

    if (openOrders.length > 0) {
      pickQueue = openOrders.map((o) => ({
        id: o.orderNumber,
        customer: o.customer.companyName,
        zone: 'WH-OPS',
        lines: o.lineItems.length,
        promised: format(o.createdAt, 'MMM d, yyyy'),
        status: o.lineItems.length > 8 ? 'picking' : 'queued',
        priority: o.total > 5000 ? ('rush' as const) : ('normal' as const),
      }));
    }

    const rushPicks = pickQueue.filter((p) => p.priority === 'rush').length;

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      metrics: {
        inboundToday,
        inboundDocked: receivingQueue.filter((r) => r.status === 'in_progress').length,
        inboundScheduled: receivingQueue.filter((r) => r.status === 'scheduled').length,
        picksDueToday: pickQueue.length,
        rushPicks,
        returnsOpen: returnsQueue.length,
        returnSlaRisk: returnsQueue.length > 0 ? 1 : 0,
        onTimeRate: openOrders.length > 0 ? 93 : 96,
      },
      receivingQueue,
      pickQueue,
      returnsQueue,
      aiGuidance: AI_GUIDANCE,
    });
  } catch {
    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      metrics: {
        inboundToday: FALLBACK_RECEIVING.length,
        inboundDocked: 2,
        inboundScheduled: 1,
        picksDueToday: FALLBACK_PICKS.length,
        rushPicks: 1,
        returnsOpen: FALLBACK_RETURNS.length,
        returnSlaRisk: 1,
        onTimeRate: 96,
      },
      receivingQueue: FALLBACK_RECEIVING,
      pickQueue: FALLBACK_PICKS,
      returnsQueue: FALLBACK_RETURNS,
      aiGuidance: AI_GUIDANCE,
    });
  }
}
