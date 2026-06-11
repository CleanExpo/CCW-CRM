import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { crmActivityToApi } from '@/lib/db/crm-serialize';
import type { Prisma } from '@prisma/client';

const ACTIVITY_INCLUDE = {
  customer: { select: { companyName: true } },
  contact: { select: { firstName: true, lastName: true } },
  order: { select: { orderNumber: true } },
  quote: { select: { quoteNumber: true } },
} satisfies Prisma.CrmActivityInclude;

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);

    const rows = await prisma.crmActivity.findMany({
      where: {
        ownerUserId: { in: workspaceUserIds },
        activityType: 'task',
        completedAt: null,
        dueDate: { not: null },
      },
      include: ACTIVITY_INCLUDE,
      orderBy: { dueDate: 'asc' },
      take: 200,
    });

    return NextResponse.json(
      rows.map((r: typeof rows[number]) => {
        const { customer, contact, order, quote, ...a } = r;
        return crmActivityToApi(a, { customer, contact, order, quote });
      })
    );
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
