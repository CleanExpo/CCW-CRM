import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { resolveCcwWorkspaceContext } from '@/lib/auth/ccw-workspace-context';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function toIso(date: Date | null | undefined) {
  return date ? date.toISOString() : null;
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;
    const rows = await prisma.ccwFollowUpAction.findMany({
      where: { ownerUserId: { in: workspaceUserIds }, ...(status ? { status } : {}) },
      include: { rule: { select: { name: true, ruleType: true } } },
      orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });

    return NextResponse.json({
      items: rows.map((row) => ({
        id: row.id,
        action_type: row.actionType,
        channel: row.channel,
        status: row.status,
        recipient_ref: row.recipientRef,
        subject: row.subject,
        body: row.body,
        payload: row.payload,
        rule: row.rule,
        call_session_id: row.callSessionId,
        scheduled_for: toIso(row.scheduledFor),
        approved_at: toIso(row.approvedAt),
        sent_at: toIso(row.sentAt),
        created_at: row.createdAt.toISOString(),
      })),
      total: rows.length,
    });
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const ctx = await resolveCcwWorkspaceContext(scope.userId);
    if (!ctx) return NextResponse.json({ detail: 'No workspace found for this user' }, { status: 403 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const bodyText = text(body.body);
    if (!bodyText) return NextResponse.json({ detail: 'body is required' }, { status: 400 });

    const ruleId = text(body.rule_id) || null;
    if (ruleId) {
      const rule = await prisma.ccwFollowUpRule.findFirst({
        where: { id: ruleId, ownerUserId: { in: ctx.workspaceUserIds } },
        select: { id: true },
      });
      if (!rule) return NextResponse.json({ detail: 'Follow-up rule not found' }, { status: 404 });
    }

    const callSessionId = text(body.call_session_id) || null;
    if (callSessionId) {
      const call = await prisma.ccwAiCallSession.findFirst({
        where: { id: callSessionId, ownerUserId: { in: ctx.workspaceUserIds } },
        select: { id: true },
      });
      if (!call) return NextResponse.json({ detail: 'Call session not found' }, { status: 404 });
    }

    const row = await prisma.ccwFollowUpAction.create({
      data: {
        ownerUserId: scope.userId,
        ruleId,
        callSessionId,
        actionType: text(body.action_type, 'email'),
        channel: text(body.channel, 'email'),
        status: 'draft',
        recipientRef: text(body.recipient_ref) || null,
        subject: text(body.subject) || null,
        body: bodyText,
        payload: {
          source: text(body.source, 'manual'),
          approval_required_before_send: true,
        },
      },
    });

    return NextResponse.json(
      {
        id: row.id,
        action_type: row.actionType,
        channel: row.channel,
        status: row.status,
        subject: row.subject,
        body: row.body,
        created_at: row.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
