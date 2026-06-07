import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

function serializeInstance(row: {
  id: string;
  slaRuleId: string;
  entityId: string;
  entityType: string;
  deadline: Date;
  breached: boolean;
  breachNotified: boolean;
  createdAt: Date;
}) {
  return {
    id: row.id,
    sla_rule_id: row.slaRuleId,
    entity_id: row.entityId,
    entity_type: row.entityType,
    deadline: row.deadline.toISOString(),
    breached: row.breached,
    breach_notified: row.breachNotified,
    created_at: row.createdAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entity_type');
    const breached = searchParams.get('breached');

    const ownerIds = await getWorkspaceMemberUserIds(scope.userId);
    const rows = await prisma.sLAInstance.findMany({
      where: {
        ...(entityType ? { entityType } : {}),
        ...(breached != null ? { breached: breached === 'true' } : {}),
        rule: { ownerUserId: { in: ownerIds } },
      },
      orderBy: { deadline: 'asc' },
      take: 200,
    });

    return NextResponse.json(rows.map(serializeInstance));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
