import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const rows = await prisma.ccwFollowUpRule.findMany({
      where: { ownerUserId: { in: workspaceUserIds } },
      include: { agent: { select: { agentCode: true, name: true } }, _count: { select: { actions: true } } },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });

    return NextResponse.json({
      items: rows.map((row) => ({
        id: row.id,
        rule_type: row.ruleType,
        name: row.name,
        status: row.status,
        requires_approval: row.requiresApproval,
        agent: row.agent,
        trigger_config: row.triggerConfig,
        channel_config: row.channelConfig,
        counts: { actions: row._count.actions },
        created_at: row.createdAt.toISOString(),
        updated_at: row.updatedAt.toISOString(),
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

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const name = text(body.name);
    if (!name) return NextResponse.json({ detail: 'name is required' }, { status: 400 });

    const agentCode = text(body.agent_code);
    const agent = agentCode
      ? await prisma.ccwSpecializedAgent.findFirst({
          where: { ownerUserId: scope.userId, agentCode },
          select: { id: true },
        })
      : null;

    const row = await prisma.ccwFollowUpRule.create({
      data: {
        ownerUserId: scope.userId,
        agentId: agent?.id ?? null,
        ruleType: text(body.rule_type, 'opportunity_follow_up'),
        name,
        triggerConfig: {
          trigger: text(body.trigger, 'manual_review'),
          source: text(body.source, 'phone_agent'),
        },
        channelConfig: {
          channel: text(body.channel, 'email'),
          send_requires_approval: true,
        },
        status: text(body.status, 'draft'),
        requiresApproval: true,
      },
    });

    return NextResponse.json(
      {
        id: row.id,
        rule_type: row.ruleType,
        name: row.name,
        status: row.status,
        requires_approval: row.requiresApproval,
        created_at: row.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
