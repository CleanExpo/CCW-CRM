import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const days = Math.min(365, Math.max(1, Number(request.nextUrl.searchParams.get('days') ?? 30)));
    const since = new Date(Date.now() - days * 86400000);
    const ownerIds = await getWorkspaceMemberUserIds(scope.userId);

    const instances = await prisma.workflowInstance.findMany({
      where: { ownerUserId: { in: ownerIds }, startedAt: { gte: since } },
      select: {
        status: true,
        startedAt: true,
        completedAt: true,
      },
    });

    const byStatus: Record<string, number> = {};
    let totalDurationMs = 0;
    let completedCount = 0;

    for (const inst of instances) {
      byStatus[inst.status] = (byStatus[inst.status] ?? 0) + 1;
      if (inst.completedAt) {
        totalDurationMs += inst.completedAt.getTime() - inst.startedAt.getTime();
        completedCount++;
      }
    }

    const slaBreaches = await prisma.sLAInstance.count({
      where: {
        breached: true,
        createdAt: { gte: since },
        rule: { ownerUserId: { in: ownerIds } },
      },
    });

    const slaTotal = await prisma.sLAInstance.count({
      where: {
        createdAt: { gte: since },
        rule: { ownerUserId: { in: ownerIds } },
      },
    });

    return NextResponse.json({
      period_days: days,
      total_instances: instances.length,
      by_status: byStatus,
      average_execution_minutes:
        completedCount > 0 ? Math.round(totalDurationMs / completedCount / 60000) : 0,
      sla_compliance_rate:
        slaTotal > 0 ? Math.round(((slaTotal - slaBreaches) / slaTotal) * 100) : 100,
      sla_breaches: slaBreaches,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
