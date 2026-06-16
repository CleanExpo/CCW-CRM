import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { upsertCcwDiscoveredCallSession } from '@/lib/phone-agent/call-session-service';

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

    const result = await upsertCcwDiscoveredCallSession({
      owner_user_id: scope.userId,
      customer_id: text(body.customer_id) || null,
      contact_id: text(body.contact_id) || null,
      twilio_call_sid: text(body.twilio_call_sid) || null,
      elevenlabs_call_id: text(body.elevenlabs_call_id) || null,
      direction: text(body.direction, 'inbound'),
      channel: text(body.channel, 'phone'),
      caller_number: text(body.caller_number) || null,
      transcript: transcript || null,
      summary: summary || null,
      consent_captured: Boolean(body.consent_captured),
      recording_url: text(body.recording_url) || null,
      started_at: dateOrNull(body.started_at),
      ended_at: dateOrNull(body.ended_at),
      source: text(body.source, 'manual_capture'),
      metadata: {
        captured_by: 'authenticated_dashboard',
      },
    });

    return NextResponse.json(
      result,
      { status: result.created ? 201 : 200 }
    );
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
