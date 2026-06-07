import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { logOperationalEvent } from '@/lib/comms/operational-events';

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const body = (await request.json()) as {
      approval_ids?: string[];
      comments?: string;
    };

    if (!Array.isArray(body.approval_ids) || body.approval_ids.length === 0) {
      return NextResponse.json({ detail: 'approval_ids array is required' }, { status: 400 });
    }

    const ownerIds = await getWorkspaceMemberUserIds(scope.userId);
    const results: Array<{ approval_id: string; success: boolean; error?: string }> = [];

    for (const approvalId of body.approval_ids) {
      try {
        const approval = await prisma.approval.findFirst({
          where: { id: approvalId, ownerUserId: { in: ownerIds }, status: 'pending' },
          include: { steps: true },
        });
        if (!approval) {
          results.push({ approval_id: approvalId, success: false, error: 'Not found or not pending' });
          continue;
        }

        const step = approval.steps.find(
          (s) =>
            s.status === 'pending' &&
            s.stepNumber === approval.currentStep &&
            s.approverId === scope.userId
        );
        if (!step) {
          results.push({ approval_id: approvalId, success: false, error: 'No actionable step' });
          continue;
        }

        await prisma.approvalStep.update({
          where: { id: step.id },
          data: {
            status: 'approved',
            comments: body.comments ?? null,
            reviewedAt: new Date(),
          },
        });

        let approvalStatus = approval.status;
        let completedAt: Date | null = null;
        let currentStep = approval.currentStep;

        if (step.stepNumber >= approval.totalSteps) {
          approvalStatus = 'approved';
          completedAt = new Date();
        } else {
          currentStep = step.stepNumber + 1;
        }

        await prisma.approval.update({
          where: { id: approvalId },
          data: { status: approvalStatus, completedAt, currentStep },
        });

        await logOperationalEvent({
          ownerUserId: scope.userId,
          eventType: 'approval',
          source: 'workflow',
          title: `Bulk approved: ${approval.approvalType}`,
          entityType: approval.entityType,
          entityId: approval.entityId,
        });

        results.push({ approval_id: approvalId, success: true });
      } catch (e) {
        results.push({
          approval_id: approvalId,
          success: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    return NextResponse.json({
      total: results.length,
      succeeded,
      failed: results.length - succeeded,
      results,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
