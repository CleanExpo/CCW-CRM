import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

/** Single snapshot for the CRM hub cards (workspace-scoped). */
export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [customers, contacts, activities30d, pendingTasks] = await Promise.all([
      prisma.customer.count({ where: { ownerUserId: { in: workspaceUserIds }, isActive: true } }),
      prisma.crmContact.count({ where: { ownerUserId: { in: workspaceUserIds }, isActive: true } }),
      prisma.crmActivity.count({
        where: { ownerUserId: { in: workspaceUserIds }, createdAt: { gte: since } },
      }),
      prisma.crmActivity.count({
        where: {
          ownerUserId: { in: workspaceUserIds },
          activityType: 'task',
          completedAt: null,
        },
      }),
    ]);

    return NextResponse.json({
      customers,
      contacts,
      activities_last_30_days: activities30d,
      pending_tasks: pendingTasks,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
