import { NextRequest, NextResponse } from 'next/server';
import { upsertCcwDiscoveredCallSession } from '@/lib/phone-agent/call-session-service';
import {
  buildCanonicalTwilioWebhookUrl,
  getCcwPhoneAgentOwnerUserId,
  verifyTwilioRequestSignature,
} from '@/lib/phone-agent/provider-readiness';

function twiml(message: string, status = 200) {
  const escaped = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>${escaped}</Say><Hangup/></Response>`, {
    status,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  });
}

function text(params: URLSearchParams, key: string) {
  return params.get(key)?.trim() || null;
}

function allowUnsignedWebhook() {
  return process.env.NODE_ENV !== 'production' && process.env.PHONE_AGENT_ALLOW_UNSIGNED_WEBHOOKS === 'true';
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const params = new URLSearchParams(rawBody);
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const signature = request.headers.get('x-twilio-signature');

  if (!authToken && !allowUnsignedWebhook()) {
    return twiml('CCW phone agent is not live yet. Twilio credentials still need to be configured.', 503);
  }

  const verified =
    allowUnsignedWebhook() ||
    verifyTwilioRequestSignature({
      authToken: authToken ?? '',
      url: buildCanonicalTwilioWebhookUrl(request.url),
      params,
      signature,
    });

  if (!verified) {
    return twiml('CCW phone agent signature verification failed.', 401);
  }

  const ownerUserId = getCcwPhoneAgentOwnerUserId();
  if (!ownerUserId) {
    return twiml('CCW phone agent owner is not configured yet. Toby needs to set PHONE_AGENT_OWNER_USER_ID.', 503);
  }

  const callSid = text(params, 'CallSid');
  const from = text(params, 'From');
  const to = text(params, 'To');
  const callStatus = text(params, 'CallStatus') || 'ringing';

  await upsertCcwDiscoveredCallSession({
    owner_user_id: ownerUserId,
    twilio_call_sid: callSid,
    direction: 'inbound',
    channel: 'phone',
    caller_number: from,
    summary: `Inbound Twilio call ${callStatus}${to ? ` to ${to}` : ''}. Awaiting ElevenLabs transcript callback.`,
    transcript: null,
    source: 'twilio_voice_webhook',
    metadata: {
      twilio_call_status: callStatus,
      twilio_to_present: Boolean(to),
      provider_bridge_ready: Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_AGENT_ID),
    },
  });

  return twiml(
    'Thanks for calling Carpet Cleaners Warehouse. The AI phone pilot is configured for capture and review, but live answering still needs Toby approval.'
  );
}
