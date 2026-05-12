import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import type { ActivityType } from '@/types/activities';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const base = { ownerUserId: { in: workspaceUserIds } };

    const [grouped, pendingTasks, overdueTasks, completedThisWeek] = await Promise.all([
      prisma.crmActivity.groupBy({
        by: ['activityType'],
        where: base,
        _count: { _all: true },
      }),
      prisma.crmActivity.count({
        where: {
          ...base,
          activityType: 'task',
          completedAt: null,
        },
      }),
      prisma.crmActivity.count({
        where: {
          ...base,
          activityType: 'task',
          completedAt: null,
          dueDate: { lt: new Date() },
        },
      }),
      prisma.crmActivity.count({
        where: {
          ...base,
          activityType: 'task',
          completedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const by_type: Record<ActivityType, number> = {
      call: 0,
      email: 0,
      meeting: 0,
      note: 0,
      task: 0,
    };
    for (const row of grouped) {
      const t = row.activityType as ActivityType;
      if (t in by_type) {
        by_type[t] = row._count._all;
      }
    }

    return NextResponse.json({
      by_type,
      pending_tasks: pendingTasks,
      overdue_tasks: overdueTasks,
      completed_this_week: completedThisWeek,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
