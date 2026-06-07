import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ entityId: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { entityId } = await context.params;
    const ownerIds = await getWorkspaceMemberUserIds(scope.userId);

    const rows = await prisma.sLAInstance.findMany({
      where: {
        entityId,
        rule: { ownerUserId: { in: ownerIds } },
      },
      orderBy: { deadline: 'asc' },
    });

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        sla_rule_id: r.slaRuleId,
        entity_id: r.entityId,
        entity_type: r.entityType,
        deadline: r.deadline.toISOString(),
        breached: r.breached,
        breach_notified: r.breachNotified,
        created_at: r.createdAt.toISOString(),
      }))
    );
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
