import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { crmContactToApi } from '@/lib/db/crm-serialize';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { id } = await context.params;

    const contact = await prisma.crmContact.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds } },
    });
    if (!contact || !contact.customerId) {
      return NextResponse.json(
        { detail: 'Contact not found or not linked to a customer' },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.crmContact.updateMany({
        where: {
          customerId: contact.customerId,
          ownerUserId: { in: workspaceUserIds },
          NOT: { id },
        },
        data: { isPrimary: false },
      });
      return tx.crmContact.update({
        where: { id },
        data: { isPrimary: true },
      });
    });

    return NextResponse.json(crmContactToApi(updated));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
