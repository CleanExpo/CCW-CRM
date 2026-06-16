import { NextRequest, NextResponse } from 'next/server';
import { upsertCcwDiscoveredCallSession } from '@/lib/phone-agent/call-session-service';
import {
  getCcwPhoneAgentOwnerUserId,
  verifyPhoneAgentWebhookSignature,
} from '@/lib/phone-agent/provider-readiness';

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function dateOrNull(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function transcriptFromPayload(payload: Record<string, unknown>) {
  const transcript = text(payload.transcript);
  if (transcript) return transcript;

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const lines = messages
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const message = item as Record<string, unknown>;
      const role = text(message.role, 'speaker');
      const content = text(message.content ?? message.text);
      return content ? `${role}: ${content}` : null;
    })
    .filter((line): line is string => Boolean(line));
  return lines.join('\n');
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const secret = process.env.PHONE_AGENT_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { detail: 'PHONE_AGENT_WEBHOOK_SECRET is required before ElevenLabs callbacks are accepted.' },
      { status: 503 }
    );
  }

  const signature =
    request.headers.get('x-phone-agent-signature') ||
    request.headers.get('x-elevenlabs-signature') ||
    request.headers.get('x-webhook-signature');
  if (!verifyPhoneAgentWebhookSignature({ payload: rawBody, secret, signature })) {
    return NextResponse.json({ detail: 'Invalid phone-agent webhook signature.' }, { status: 401 });
  }

  const ownerUserId = getCcwPhoneAgentOwnerUserId();
  if (!ownerUserId) {
    return NextResponse.json(
      { detail: 'PHONE_AGENT_OWNER_USER_ID is required before callbacks can be persisted.' },
      { status: 503 }
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON payload.' }, { status: 400 });
  }
  const transcript = transcriptFromPayload(payload);
  const summary = text(payload.summary, 'ElevenLabs conversation callback received.');
  if (!transcript && !summary) {
    return NextResponse.json({ detail: 'transcript, messages, or summary is required.' }, { status: 400 });
  }

  const result = await upsertCcwDiscoveredCallSession({
    owner_user_id: ownerUserId,
    twilio_call_sid: text(payload.twilio_call_sid ?? payload.twilioCallSid) || null,
    elevenlabs_call_id: text(payload.conversation_id ?? payload.call_id ?? payload.elevenlabs_call_id) || null,
    direction: text(payload.direction, 'inbound'),
    channel: 'phone',
    caller_number: text(payload.caller_number) || null,
    transcript: transcript || null,
    summary,
    consent_captured: payload.consent_captured === true,
    recording_url: text(payload.recording_url) || null,
    started_at: dateOrNull(payload.started_at),
    ended_at: dateOrNull(payload.ended_at),
    source: 'elevenlabs_conversation_webhook',
    metadata: {
      event_type: text(payload.event_type, 'conversation'),
      provider_payload_version: text(payload.version, 'unknown'),
    },
  });

  return NextResponse.json(result, { status: result.created ? 201 : 200 });
}
