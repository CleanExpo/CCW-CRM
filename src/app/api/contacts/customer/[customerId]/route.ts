import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { crmContactToApi } from '@/lib/db/crm-serialize';
import type { CrmContact } from '@prisma/client';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ customerId: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { customerId } = await context.params;
    const includeInactive = request.nextUrl.searchParams.get('include_inactive') === 'true';

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, ownerUserId: { in: workspaceUserIds } },
      select: { id: true },
    });
    if (!customer) {
      return NextResponse.json({ detail: 'Customer not found' }, { status: 404 });
    }

    const rows = await prisma.crmContact.findMany({
      where: {
        customerId,
        ownerUserId: { in: workspaceUserIds },
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ isPrimary: 'desc' }, { lastName: 'asc' }],
    });

    return NextResponse.json(rows.map((c: CrmContact) => crmContactToApi(c)));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
