import { createHmac, timingSafeEqual } from 'crypto';

export type CcwPhoneAgentProviderKey =
  | 'FEATURE_CCW_FEASIBILITY_AI_PHONE_AGENT'
  | 'FEATURE_CCW_AI_PHONE_AGENT'
  | 'FEATURE_CCW_AI_PHONE_AGENT_AFTER_HOURS'
  | 'ELEVENLABS_API_KEY'
  | 'ELEVENLABS_AGENT_ID'
  | 'TWILIO_ACCOUNT_SID'
  | 'TWILIO_AUTH_TOKEN'
  | 'TWILIO_PHONE_NUMBER'
  | 'PHONE_AGENT_WEBHOOK_SECRET'
  | 'PHONE_AGENT_OWNER_USER_ID'
  | 'PHONE_AGENT_PUBLIC_BASE_URL';

export type CcwPhoneAgentWebhookUrls = {
  twilio_voice_url: string | null;
  elevenlabs_callback_url: string | null;
};

export const CCW_PHONE_AGENT_OWNER_EMAIL = 'toby.b@ccwarehouse.com.au';

function cleanUrl(value: string | undefined): string | null {
  const trimmed = value?.trim().replace(/\/+$/, '');
  return trimmed || null;
}

export function getCcwPhoneAgentPublicBaseUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  return cleanUrl(env.PHONE_AGENT_PUBLIC_BASE_URL) || cleanUrl(env.NEXT_PUBLIC_FRONTEND_URL);
}

export function getCcwPhoneAgentOwnerUserId(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.PHONE_AGENT_OWNER_USER_ID?.trim() || env.CRON_INTEGRATION_USER_ID?.trim() || null;
}

export function getCcwPhoneAgentOwnerEmail(env: NodeJS.ProcessEnv = process.env): string {
  return env.PHONE_AGENT_OWNER_EMAIL?.trim() || CCW_PHONE_AGENT_OWNER_EMAIL;
}

export function getCcwPhoneAgentWebhookUrls(env: NodeJS.ProcessEnv = process.env): CcwPhoneAgentWebhookUrls {
  const baseUrl = getCcwPhoneAgentPublicBaseUrl(env);
  return {
    twilio_voice_url: baseUrl ? `${baseUrl}/api/phone-agent/webhooks/twilio/voice` : null,
    elevenlabs_callback_url: baseUrl ? `${baseUrl}/api/phone-agent/webhooks/elevenlabs/conversation` : null,
  };
}

export function buildCanonicalTwilioWebhookUrl(requestUrl: string, env: NodeJS.ProcessEnv = process.env): string {
  const request = new URL(requestUrl);
  const baseUrl = getCcwPhoneAgentPublicBaseUrl(env);
  if (!baseUrl) return request.toString();

  const base = new URL(baseUrl);
  base.pathname = request.pathname;
  base.search = request.search;
  return base.toString();
}

export function verifyTwilioRequestSignature(input: {
  authToken: string;
  url: string;
  params: URLSearchParams;
  signature: string | null;
}): boolean {
  const signature = input.signature?.trim();
  if (!signature || !input.authToken.trim()) return false;

  const sortedPairs = Array.from(input.params.entries()).sort(([a], [b]) => a.localeCompare(b));
  const data = sortedPairs.reduce((acc, [key, value]) => `${acc}${key}${value}`, input.url);
  const expected = createHmac('sha1', input.authToken).update(data).digest('base64');
  return timingSafeTextEqual(signature, expected);
}

export function signPhoneAgentWebhookPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyPhoneAgentWebhookSignature(input: {
  payload: string;
  secret: string;
  signature: string | null;
}): boolean {
  const signature = input.signature?.trim().replace(/^sha256=/i, '');
  if (!signature || !input.secret.trim()) return false;

  const expected = signPhoneAgentWebhookPayload(input.payload, input.secret);
  return timingSafeTextEqual(signature, expected);
}

function timingSafeTextEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function missingCcwPhoneAgentLiveKeys(env: NodeJS.ProcessEnv = process.env): CcwPhoneAgentProviderKey[] {
  const required: CcwPhoneAgentProviderKey[] = [
    'FEATURE_CCW_FEASIBILITY_AI_PHONE_AGENT',
    'FEATURE_CCW_AI_PHONE_AGENT',
    'FEATURE_CCW_AI_PHONE_AGENT_AFTER_HOURS',
    'ELEVENLABS_API_KEY',
    'ELEVENLABS_AGENT_ID',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER',
    'PHONE_AGENT_WEBHOOK_SECRET',
    'PHONE_AGENT_OWNER_USER_ID',
    'PHONE_AGENT_PUBLIC_BASE_URL',
  ];

  return required.filter((key) => {
    if (key === 'PHONE_AGENT_OWNER_USER_ID') return !getCcwPhoneAgentOwnerUserId(env);
    if (key === 'PHONE_AGENT_PUBLIC_BASE_URL') return !getCcwPhoneAgentPublicBaseUrl(env);
    return !env[key]?.trim();
  });
}
