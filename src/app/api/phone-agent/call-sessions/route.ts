import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import {
  hashCcwCallerNumber,
  inferCcwCallTriage,
} from '@/lib/phone-agent/conversation-intelligence';
import type { Prisma } from '@prisma/client';

function toIso(date: Date | null | undefined) {
  return date ? date.toISOString() : null;
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function dateOrNull(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const transcript = text(body.transcript);
    const summary = text(body.summary);
    if (!transcript && !summary) {
      return NextResponse.json({ detail: 'transcript or summary is required' }, { status: 400 });
    }

    const triage = inferCcwCallTriage(transcript, summary);
    const twilioCallSid = text(body.twilio_call_sid) || null;
    const existing = twilioCallSid
      ? await prisma.ccwAiCallSession.findUnique({ where: { twilioCallSid }, select: { id: true } })
      : null;

    const data = {
      ownerUserId: scope.userId,
      customerId: text(body.customer_id) || null,
      contactId: text(body.contact_id) || null,
      twilioCallSid,
      elevenlabsCallId: text(body.elevenlabs_call_id) || null,
      direction: text(body.direction, 'inbound'),
      channel: text(body.channel, 'phone'),
      callerNumberHash: hashCcwCallerNumber(text(body.caller_number) || null),
      transcript: transcript || null,
      summary: summary || null,
      intent: triage.intent,
      outcome: triage.outcome,
      handoffRequired: triage.handoff_required,
      consentCaptured: Boolean(body.consent_captured),
      recordingUrl: text(body.recording_url) || null,
      startedAt: dateOrNull(body.started_at),
      endedAt: dateOrNull(body.ended_at),
      metadata: {
        source: text(body.source, 'manual_capture'),
        triage_version: 'deterministic-v1',
        raw_phone_number_stored: false,
      },
    };

    const row = await prisma.$transaction(async (tx) => {
      const call = existing
        ? await tx.ccwAiCallSession.update({ where: { id: existing.id }, data })
        : await tx.ccwAiCallSession.create({ data });

      await tx.ccwAiCallTriageDecision.upsert({
        where: { callSessionId: call.id },
        create: {
          callSessionId: call.id,
          decision: triage.decision,
          reason: triage.reason,
          confidenceScore: triage.confidence_score,
          metadata: {
            learning_agent_code: triage.learning_agent_code,
            learning_lesson: triage.learning_lesson,
          },
        },
        update: {
          decision: triage.decision,
          reason: triage.reason,
          confidenceScore: triage.confidence_score,
          metadata: {
            learning_agent_code: triage.learning_agent_code,
            learning_lesson: triage.learning_lesson,
          },
        },
      });

      await tx.ccwAiConversationInsight.deleteMany({ where: { callSessionId: call.id } });
      if (triage.insights.length > 0) {
        await tx.ccwAiConversationInsight.createMany({
          data: triage.insights.map((insight) => ({
            ownerUserId: scope.userId,
            callSessionId: call.id,
            insightType: insight.insight_type,
            label: insight.label,
            detail: insight.detail,
            evidence: insight.evidence as Prisma.InputJsonValue,
            status: 'new',
          })),
        });
      }

      await tx.ccwFollowUpAction.deleteMany({ where: { callSessionId: call.id, status: 'draft' } });
      if (triage.follow_up_actions.length > 0) {
        await tx.ccwFollowUpAction.createMany({
          data: triage.follow_up_actions.map((action) => ({
            ownerUserId: scope.userId,
            callSessionId: call.id,
            actionType: action.action_type,
            channel: action.channel,
            status: 'draft',
            subject: action.subject,
            body: action.body,
            payload: action.payload as Prisma.InputJsonValue,
          })),
        });
      }

      return call;
    });

    return NextResponse.json(
      {
        id: row.id,
        intent: row.intent,
        outcome: row.outcome,
        handoff_required: row.handoffRequired,
        triage_decision: {
          decision: triage.decision,
          reason: triage.reason,
          confidence_score: triage.confidence_score,
        },
        insights_created: triage.insights.length,
        follow_up_actions_created: triage.follow_up_actions.length,
        learning_candidate: {
          agent_code: triage.learning_agent_code,
          lesson: triage.learning_lesson,
        },
      },
      { status: existing ? 200 : 201 }
    );
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
