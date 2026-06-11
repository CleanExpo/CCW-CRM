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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ contactId: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { contactId } = await context.params;
    const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '20', 10)));

    const contact = await prisma.crmContact.findFirst({
      where: { id: contactId, ownerUserId: { in: workspaceUserIds } },
      select: { id: true },
    });
    if (!contact) {
      return NextResponse.json({ detail: 'Contact not found' }, { status: 404 });
    }

    const rows = await prisma.crmActivity.findMany({
      where: { contactId, ownerUserId: { in: workspaceUserIds } },
      include: ACTIVITY_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: limit,
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
