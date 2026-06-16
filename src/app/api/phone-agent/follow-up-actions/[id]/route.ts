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

function toIso(date: Date | null | undefined) {
  return date ? date.toISOString() : null;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const existing = await prisma.ccwFollowUpAction.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds } },
    });
    if (!existing) return NextResponse.json({ detail: 'Follow-up action not found' }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = text(body.action, 'approve');
    const payload = asRecord(existing.payload);
    const now = new Date();

    const data: Prisma.CcwFollowUpActionUpdateInput =
      action === 'reject'
        ? {
            status: 'rejected',
            payload: {
              ...payload,
              rejected_by: scope.userId,
              rejected_at: now.toISOString(),
              rejection_reason: text(body.reason) || null,
            },
          }
        : action === 'reopen'
          ? {
              status: 'draft',
              approvedBy: null,
              approvedAt: null,
              payload: {
                ...payload,
                reopened_by: scope.userId,
                reopened_at: now.toISOString(),
              },
            }
          : {
              status: 'approved',
              approvedBy: scope.userId,
              approvedAt: now,
              payload: {
                ...payload,
                approved_by: scope.userId,
                approved_at: now.toISOString(),
                send_still_requires_explicit_delivery_step: true,
              },
            };

    const row = await prisma.ccwFollowUpAction.update({ where: { id }, data });
    return NextResponse.json({
      id: row.id,
      action_type: row.actionType,
      channel: row.channel,
      status: row.status,
      subject: row.subject,
      body: row.body,
      approved_at: toIso(row.approvedAt),
      sent_at: toIso(row.sentAt),
      payload: row.payload,
    });
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
