import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

/**
 * Stock moves immediately on POST /api/inventory/transfer (status completed).
 * Multi-step workflow (pending → in_transit) is not implemented.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const scope = await requireAuthScope(req);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);

    const row = await prisma.stockTransfer.findFirst({
      where: {
        id,
        product: { ownerUserId: { in: workspaceUserIds } },
      },
      select: { id: true, status: true },
    });

    if (!row) {
      return NextResponse.json({ detail: 'Transfer not found' }, { status: 404 });
    }

    if (row.status === 'completed') {
      return NextResponse.json(
        { detail: 'This transfer is already completed; stock was moved when it was created.' },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { detail: 'Multi-step transfer status is not supported; create a new transfer instead.' },
      { status: 501 },
    );
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
