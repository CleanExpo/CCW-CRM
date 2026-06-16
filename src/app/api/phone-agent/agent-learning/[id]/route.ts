import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import type { Prisma } from '@prisma/client';

type Params = { params: Promise<{ id: string }> };

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const learning = await prisma.ccwAgentLearning.findFirst({
      where: { id, agent: { ownerUserId: { in: workspaceUserIds } } },
      include: { agent: true },
    });
    if (!learning) return NextResponse.json({ detail: 'Learning item not found' }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = text(body.action, 'approve');
    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.ccwAgentLearning.update({
        where: { id },
        data: {
          status: action === 'reject' ? 'rejected' : 'approved',
          metadata: {
            ...asRecord(learning.metadata),
            reviewed_by: scope.userId,
            reviewed_at: now.toISOString(),
            review_note: text(body.note) || null,
          } as Prisma.InputJsonValue,
        },
      });

      if (action !== 'reject') {
        const playbook = asRecord(learning.agent.playbook);
        const approvedLessons = Array.isArray(playbook.approved_lessons)
          ? playbook.approved_lessons.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
          : [];

        await tx.ccwSpecializedAgent.update({
          where: { id: learning.agentId },
          data: {
            playbook: {
              ...playbook,
              approved_lessons: [
                ...approvedLessons,
                {
                  learning_id: learning.id,
                  lesson: learning.lesson,
                  approved_at: now.toISOString(),
                },
              ],
            } as Prisma.InputJsonValue,
          },
        });
      }

      return row;
    });

    return NextResponse.json({
      id: updated.id,
      agent_id: updated.agentId,
      lesson: updated.lesson,
      status: updated.status,
      updated_at: updated.updatedAt.toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
