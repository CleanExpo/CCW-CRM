import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

type Params = { params: Promise<{ id: string }> };

function toIso(date: Date | null | undefined) {
  return date ? date.toISOString() : null;
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const row = await prisma.ccwAiCallSession.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds } },
      include: {
        triageDecision: true,
        insights: { orderBy: { createdAt: 'desc' } },
        followUpActions: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!row) return NextResponse.json({ detail: 'Call session not found' }, { status: 404 });

    return NextResponse.json({
      id: row.id,
      direction: row.direction,
      channel: row.channel,
      twilio_call_sid_present: Boolean(row.twilioCallSid),
      elevenlabs_call_id_present: Boolean(row.elevenlabsCallId),
      transcript: row.transcript,
      summary: row.summary,
      intent: row.intent,
      outcome: row.outcome,
      handoff_required: row.handoffRequired,
      consent_captured: row.consentCaptured,
      recording_url_present: Boolean(row.recordingUrl),
      started_at: toIso(row.startedAt),
      ended_at: toIso(row.endedAt),
      metadata: row.metadata,
      triage_decision: row.triageDecision
        ? {
            decision: row.triageDecision.decision,
            reason: row.triageDecision.reason,
            confidence_score: row.triageDecision.confidenceScore,
            human_reviewer_id: row.triageDecision.humanReviewerId,
            reviewed_at: toIso(row.triageDecision.reviewedAt),
            metadata: row.triageDecision.metadata,
          }
        : null,
      insights: row.insights.map((insight) => ({
        id: insight.id,
        insight_type: insight.insightType,
        label: insight.label,
        detail: insight.detail,
        evidence: insight.evidence,
        status: insight.status,
        created_at: insight.createdAt.toISOString(),
      })),
      follow_up_actions: row.followUpActions.map((action) => ({
        id: action.id,
        action_type: action.actionType,
        channel: action.channel,
        status: action.status,
        recipient_ref: action.recipientRef,
        subject: action.subject,
        body: action.body,
        scheduled_for: toIso(action.scheduledFor),
        approved_at: toIso(action.approvedAt),
        sent_at: toIso(action.sentAt),
      })),
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
