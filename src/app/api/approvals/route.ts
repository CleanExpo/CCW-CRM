import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { serializeApproval } from '@/lib/workflows/approvals-serialize';
import {
  createSlaInstanceForEntity,
  dispatchWorkflowTrigger,
} from '@/lib/workflows/workflow-engine';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') ?? 1));
    const pageSize = Math.min(100, Number(searchParams.get('page_size') ?? 20));
    const statusFilter = searchParams.get('status_filter');
    const approvalType = searchParams.get('approval_type');

    const ownerIds = await getWorkspaceMemberUserIds(scope.userId);
    const where = {
      ownerUserId: { in: ownerIds },
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(approvalType ? { approvalType } : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.approval.count({ where }),
      prisma.approval.findMany({
        where,
        include: { steps: { orderBy: { stepNumber: 'asc' } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      data: rows.map(serializeApproval),
      total,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(total / pageSize) || 1,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const body = (await request.json()) as {
      approval_type?: string;
      entity_id?: string;
      entity_type?: string;
      total_steps?: number;
      requested_by?: string;
      notes?: string;
    };

    if (!body.approval_type || !body.entity_id || !body.entity_type) {
      return NextResponse.json({ detail: 'Missing required fields' }, { status: 400 });
    }

    const row = await prisma.approval.create({
      data: {
        ownerUserId: scope.userId,
        approvalType: body.approval_type,
        entityId: body.entity_id,
        entityType: body.entity_type,
        totalSteps: body.total_steps ?? 1,
        requestedBy: body.requested_by ?? scope.userId,
        notes: body.notes ?? null,
        steps: {
          create: {
            stepNumber: 1,
            approverId: scope.userId,
            approverRole: 'manager',
            status: 'pending',
          },
        },
      },
      include: { steps: { orderBy: { stepNumber: 'asc' } } },
    });

    await createSlaInstanceForEntity(scope.userId, 'approval', row.id);

    void dispatchWorkflowTrigger('approval_required', {
      ownerUserId: scope.userId,
      triggerEntityType: row.entityType,
      triggerEntityId: row.entityId,
      payload: { approval_id: row.id, approval_type: row.approvalType },
    });

    return NextResponse.json(serializeApproval(row), { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
