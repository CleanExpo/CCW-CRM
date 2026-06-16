import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import {
  ccwWorkspaceRecordOwnerId,
  resolveCcwWorkspaceContext,
} from '@/lib/auth/ccw-workspace-context';
import { defaultCcwSpecializedAgent } from '@/lib/phone-agent/conversation-intelligence';

type Params = { params: Promise<{ id: string }> };

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const ctx = await resolveCcwWorkspaceContext(scope.userId);
    if (!ctx) return NextResponse.json({ detail: 'No workspace found for this user' }, { status: 403 });

    const { id } = await params;
    const workspaceUserIds = ctx.workspaceUserIds;
    const call = await prisma.ccwAiCallSession.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds } },
      include: { triageDecision: true },
    });
    if (!call) return NextResponse.json({ detail: 'Call session not found' }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const metadata =
      call.triageDecision?.metadata && typeof call.triageDecision.metadata === 'object'
        ? (call.triageDecision.metadata as Record<string, unknown>)
        : {};
    const agentCode = text(body.agent_code, text(metadata.learning_agent_code, 'front-desk-agent'));
    const seed = defaultCcwSpecializedAgent(agentCode);
    const workspaceOwnerUserId = ccwWorkspaceRecordOwnerId(ctx);
    const agent = await prisma.ccwSpecializedAgent.upsert({
      where: {
        ownerUserId_agentCode: { ownerUserId: workspaceOwnerUserId, agentCode },
      },
      create: {
        ownerUserId: workspaceOwnerUserId,
        agentCode,
        name: seed.name,
        purpose: seed.purpose,
        persona: seed.persona,
        playbook: seed.playbook,
        requiresApproval: true,
      },
      update: {},
    });
    const lesson = text(
      body.lesson,
      text(metadata.learning_lesson, 'Review this call and decide whether the playbook should change.')
    );

    const learning = await prisma.ccwAgentLearning.create({
      data: {
        agentId: agent.id,
        sourceType: 'phone_conversation',
        sourceId: call.id,
        lesson,
        confidenceScore: call.triageDecision?.confidenceScore ?? null,
        status: 'pending_review',
        metadata: {
          intent: call.intent,
          outcome: call.outcome,
          handoff_required: call.handoffRequired,
        },
      },
    });

    return NextResponse.json(
      {
        id: learning.id,
        agent_id: agent.id,
        agent_code: agent.agentCode,
        lesson: learning.lesson,
        confidence_score: learning.confidenceScore,
        status: learning.status,
        created_at: learning.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
