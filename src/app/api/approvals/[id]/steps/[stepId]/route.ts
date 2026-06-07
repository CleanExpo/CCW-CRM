import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { serializeStep } from '@/lib/workflows/approvals-serialize';
import { logOperationalEvent } from '@/lib/comms/operational-events';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id, stepId } = await context.params;
    const body = (await request.json()) as { action?: 'approve' | 'reject'; comments?: string };

    if (!body.action) {
      return NextResponse.json({ detail: 'action is required' }, { status: 400 });
    }

    const ownerIds = await getWorkspaceMemberUserIds(scope.userId);
    const approval = await prisma.approval.findFirst({
      where: { id, ownerUserId: { in: ownerIds } },
      include: { steps: true },
    });
    if (!approval) return NextResponse.json({ detail: 'Not found' }, { status: 404 });

    const step = approval.steps.find((s) => s.id === stepId);
    if (!step || step.status !== 'pending') {
      return NextResponse.json({ detail: 'Step not actionable' }, { status: 400 });
    }

    const stepStatus = body.action === 'approve' ? 'approved' : 'rejected';
    const updatedStep = await prisma.approvalStep.update({
      where: { id: stepId },
      data: {
        status: stepStatus,
        comments: body.comments ?? null,
        reviewedAt: new Date(),
      },
    });

    let approvalStatus = approval.status;
    let completedAt: Date | null = null;
    let currentStep = approval.currentStep;

    if (body.action === 'reject') {
      approvalStatus = 'rejected';
      completedAt = new Date();
    } else if (step.stepNumber >= approval.totalSteps) {
      approvalStatus = 'approved';
      completedAt = new Date();
    } else {
      currentStep = step.stepNumber + 1;
    }

    await prisma.approval.update({
      where: { id },
      data: { status: approvalStatus, completedAt, currentStep },
    });

    await logOperationalEvent({
      ownerUserId: scope.userId,
      eventType: 'approval',
      source: 'workflow',
      title: `Approval ${stepStatus}: ${approval.approvalType}`,
      description: body.comments ?? null,
      entityType: approval.entityType,
      entityId: approval.entityId,
    });

    return NextResponse.json(serializeStep(updatedStep));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
