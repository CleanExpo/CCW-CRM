import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { serializeApproval } from '@/lib/workflows/approvals-serialize';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await context.params;
    const ownerIds = await getWorkspaceMemberUserIds(scope.userId);
    const row = await prisma.approval.findFirst({
      where: { id, ownerUserId: { in: ownerIds } },
      include: { steps: { orderBy: { stepNumber: 'asc' } } },
    });
    if (!row) return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    return NextResponse.json(serializeApproval(row));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await context.params;
    const ownerIds = await getWorkspaceMemberUserIds(scope.userId);
    const row = await prisma.approval.findFirst({
      where: { id, ownerUserId: { in: ownerIds }, status: 'pending' },
    });
    if (!row) return NextResponse.json({ detail: 'Not found' }, { status: 404 });

    await prisma.approval.update({
      where: { id },
      data: { status: 'cancelled', completedAt: new Date() },
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
