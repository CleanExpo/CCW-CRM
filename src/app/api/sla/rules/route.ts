import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const ownerIds = await getWorkspaceMemberUserIds(scope.userId);
    const rows = await prisma.sLARule.findMany({
      where: { ownerUserId: { in: ownerIds }, isActive: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        entity_type: r.entityType,
        sla_hours: r.slaHours,
        escalation_action: r.escalationAction,
        is_active: r.isActive,
      }))
    );
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
