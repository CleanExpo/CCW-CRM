import { prisma } from '@/lib/db/prisma';
import {
  hashCcwCallerNumber,
  inferCcwCallTriage,
} from '@/lib/phone-agent/conversation-intelligence';
import type { Prisma } from '@prisma/client';

export type CcwDiscoveredCallInput = {
  owner_user_id: string;
  customer_id?: string | null;
  contact_id?: string | null;
  twilio_call_sid?: string | null;
  elevenlabs_call_id?: string | null;
  direction?: string | null;
  channel?: string | null;
  caller_number?: string | null;
  transcript?: string | null;
  summary?: string | null;
  consent_captured?: boolean | null;
  recording_url?: string | null;
  started_at?: Date | null;
  ended_at?: Date | null;
  source?: string | null;
  metadata?: Record<string, unknown>;
};

export type CcwDiscoveredCallResult = {
  id: string;
  created: boolean;
  intent: string | null;
  outcome: string | null;
  handoff_required: boolean;
  triage_decision: {
    decision: string;
    reason: string;
    confidence_score: number;
  };
  insights_created: number;
  follow_up_actions_created: number;
  learning_candidate: {
    agent_code: string;
    lesson: string;
  };
};

function text(value: string | null | undefined, fallback = '') {
  return value?.trim() || fallback;
}

export async function upsertCcwDiscoveredCallSession(
  input: CcwDiscoveredCallInput
): Promise<CcwDiscoveredCallResult> {
  const transcript = text(input.transcript);
  const summary = text(input.summary);
  if (!transcript && !summary) {
    throw new Error('transcript or summary is required');
  }

  const triage = inferCcwCallTriage(transcript, summary);
  const twilioCallSid = text(input.twilio_call_sid) || null;
  const existing = twilioCallSid
    ? await prisma.ccwAiCallSession.findUnique({ where: { twilioCallSid }, select: { id: true } })
    : null;

  const data = {
    ownerUserId: input.owner_user_id,
    customerId: text(input.customer_id) || null,
    contactId: text(input.contact_id) || null,
    twilioCallSid,
    elevenlabsCallId: text(input.elevenlabs_call_id) || null,
    direction: text(input.direction, 'inbound'),
    channel: text(input.channel, 'phone'),
    callerNumberHash: hashCcwCallerNumber(input.caller_number),
    transcript: transcript || null,
    summary: summary || null,
    intent: triage.intent,
    outcome: triage.outcome,
    handoffRequired: triage.handoff_required,
    consentCaptured: input.consent_captured === true,
    recordingUrl: text(input.recording_url) || null,
    startedAt: input.started_at ?? null,
    endedAt: input.ended_at ?? null,
    metadata: {
      source: text(input.source, 'manual_capture'),
      triage_version: 'deterministic-v1',
      raw_phone_number_stored: false,
      ...(input.metadata ?? {}),
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
          ownerUserId: input.owner_user_id,
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
          ownerUserId: input.owner_user_id,
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

  return {
    id: row.id,
    created: !existing,
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
  };
}
