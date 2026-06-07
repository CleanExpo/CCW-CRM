import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { serializeStep } from '@/lib/workflows/approvals-serialize';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await context.params;
    const body = (await request.json()) as {
      step_number?: number;
      approver_id?: string;
      approver_role?: string;
    };

    const ownerIds = await getWorkspaceMemberUserIds(scope.userId);
    const approval = await prisma.approval.findFirst({
      where: { id, ownerUserId: { in: ownerIds } },
    });
    if (!approval) return NextResponse.json({ detail: 'Not found' }, { status: 404 });

    const step = await prisma.approvalStep.create({
      data: {
        approvalId: id,
        stepNumber: body.step_number ?? approval.totalSteps + 1,
        approverId: body.approver_id ?? scope.userId,
        approverRole: body.approver_role ?? null,
      },
    });

    await prisma.approval.update({
      where: { id },
      data: { totalSteps: { increment: 1 } },
    });

    return NextResponse.json(serializeStep(step), { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
