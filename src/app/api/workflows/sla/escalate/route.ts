import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { checkSlaBreaches } from '@/lib/workflows/workflow-engine';

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const body = (await request.json()) as {
      entity_type?: string;
      entity_id?: string;
      sla_instance_id?: string;
    };

    const ownerIds = await getWorkspaceMemberUserIds(scope.userId);

    if (body.sla_instance_id) {
      const inst = await prisma.sLAInstance.findFirst({
        where: {
          id: body.sla_instance_id,
          rule: { ownerUserId: { in: ownerIds } },
        },
        include: { rule: true },
      });
      if (!inst) return NextResponse.json({ detail: 'SLA instance not found' }, { status: 404 });

      await prisma.sLAInstance.update({
        where: { id: inst.id },
        data: { breached: true, breachNotified: true },
      });

      const result = await checkSlaBreaches(scope.userId);
      return NextResponse.json({
        escalated: true,
        entity_type: inst.entityType,
        entity_id: inst.entityId,
        rule_name: inst.rule.name,
        ...result,
      });
    }

    if (body.entity_type && body.entity_id) {
      const inst = await prisma.sLAInstance.findFirst({
        where: {
          entityType: body.entity_type,
          entityId: body.entity_id,
          rule: { ownerUserId: { in: ownerIds } },
        },
        include: { rule: true },
      });
      if (!inst) return NextResponse.json({ detail: 'SLA instance not found' }, { status: 404 });

      await prisma.sLAInstance.update({
        where: { id: inst.id },
        data: { breached: true, breachNotified: true },
      });

      await checkSlaBreaches(scope.userId);
      return NextResponse.json({
        escalated: true,
        sla_instance_id: inst.id,
        entity_type: inst.entityType,
        entity_id: inst.entityId,
      });
    }

    const result = await checkSlaBreaches(scope.userId);
    return NextResponse.json({ escalated: true, ...result });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
