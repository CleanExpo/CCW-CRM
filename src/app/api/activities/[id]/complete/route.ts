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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { id } = await context.params;

    const existing = await prisma.crmActivity.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds }, activityType: 'task' },
    });
    if (!existing) {
      return NextResponse.json({ detail: 'Task not found' }, { status: 404 });
    }

    const updated = await prisma.crmActivity.update({
      where: { id },
      data: { completedAt: new Date() },
      include: ACTIVITY_INCLUDE,
    });

    const { customer, contact, order, quote, ...a } = updated;
    return NextResponse.json(crmActivityToApi(a, { customer, contact, order, quote }));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
