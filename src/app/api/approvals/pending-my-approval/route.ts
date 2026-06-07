import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { serializeApproval } from '@/lib/workflows/approvals-serialize';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const ownerIds = await getWorkspaceMemberUserIds(scope.userId);
    const rows = await prisma.approval.findMany({
      where: {
        ownerUserId: { in: ownerIds },
        status: 'pending',
        steps: {
          some: {
            status: 'pending',
            approverId: scope.userId,
          },
        },
      },
      include: { steps: { orderBy: { stepNumber: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(rows.map(serializeApproval));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
