import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

function toIso(date: Date | null | undefined) {
  return date ? date.toISOString() : null;
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const rows = await prisma.ccwAiCallSession.findMany({
      where: { ownerUserId: { in: workspaceUserIds } },
      include: {
        triageDecision: true,
        _count: { select: { insights: true, followUpActions: true } },
      },
      orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });

    return NextResponse.json({
      items: rows.map((row) => ({
        id: row.id,
        direction: row.direction,
        channel: row.channel,
        intent: row.intent,
        outcome: row.outcome,
        summary: row.summary,
        handoff_required: row.handoffRequired,
        consent_captured: row.consentCaptured,
        started_at: toIso(row.startedAt),
        ended_at: toIso(row.endedAt),
        triage_decision: row.triageDecision
          ? {
              decision: row.triageDecision.decision,
              reason: row.triageDecision.reason,
              confidence_score: row.triageDecision.confidenceScore,
              reviewed_at: toIso(row.triageDecision.reviewedAt),
            }
          : null,
        counts: {
          insights: row._count.insights,
          follow_up_actions: row._count.followUpActions,
        },
        updated_at: row.updatedAt.toISOString(),
      })),
      total: rows.length,
    });
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
