import type { NextRequest } from 'next/server';

const SENDGRID_API = 'https://api.sendgrid.com/v3';

export type SendGridCredentialSource = 'environment' | 'session' | 'none';

export function getSendGridApiKey(request?: NextRequest): string | null {
  const fromCookie = request?.cookies.get('sendgrid_api_key')?.value?.trim();
  if (fromCookie) return fromCookie;
  return process.env.SENDGRID_API_KEY?.trim() || null;
}

export function getSendGridCredentialSource(request?: NextRequest): SendGridCredentialSource {
  const cookie = request?.cookies.get('sendgrid_api_key')?.value?.trim();
  if (cookie) return 'session';
  if (process.env.SENDGRID_API_KEY?.trim()) return 'environment';
  return 'none';
}

export function getSendGridFromEmail(request?: NextRequest): string | null {
  return (
    request?.cookies.get('sendgrid_from_email')?.value?.trim() ||
    process.env.SENDGRID_FROM_EMAIL?.trim() ||
    null
  );
}

export function getSendGridFromName(request?: NextRequest): string | null {
  return (
    request?.cookies.get('sendgrid_from_name')?.value?.trim() ||
    process.env.SENDGRID_FROM_NAME?.trim() ||
    null
  );
}

export function isSendGridDemoMode(): boolean {
  return process.env.SENDGRID_MODE === 'demo';
}

/** Lightweight check that the API key is accepted by SendGrid. */
export async function verifySendGridApiKey(apiKey: string): Promise<boolean> {
  const res = await fetch(`${SENDGRID_API}/user/profile`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  });
  return res.ok;
}

export type SendGridMailPayload = {
  to_email: string;
  subject: string;
  body_text: string;
  body_html?: string | null;
};

export type SendGridMailResult =
  | { ok: true; message_id: string; mode: 'demo' | 'live' }
  | { ok: false; status: number; detail: string };

/**
 * Sends a single transactional email via SendGrid v3 mail/send.
 * Caller must enforce auth / quotas.
 */
export async function sendMailViaSendGrid(
  apiKey: string,
  fromEmail: string,
  fromName: string | null,
  payload: SendGridMailPayload
): Promise<SendGridMailResult> {
  if (isSendGridDemoMode()) {
    return {
      ok: true,
      message_id: `demo-${Date.now()}`,
      mode: 'demo',
    };
  }

  const content: Array<{ type: string; value: string }> = [
    { type: 'text/plain', value: payload.body_text },
  ];
  if (payload.body_html?.trim()) {
    content.push({ type: 'text/html', value: payload.body_html.trim() });
  }

  const body = {
    personalizations: [{ to: [{ email: payload.to_email.trim() }] }],
    from: {
      email: fromEmail.trim(),
      ...(fromName?.trim() ? { name: fromName.trim() } : {}),
    },
    subject: payload.subject.trim(),
    content,
  };

  const res = await fetch(`${SENDGRID_API}/mail/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (res.status === 202) {
    const messageId = res.headers.get('x-message-id')?.trim() || `sg-${Date.now()}`;
    return { ok: true, message_id: messageId, mode: 'live' };
  }

  let detail = `SendGrid returned HTTP ${res.status}`;
  try {
    const errJson = (await res.json()) as { errors?: Array<{ message?: string }> };
    const first = errJson?.errors?.[0]?.message;
    if (first) detail = first;
  } catch {
    const t = await res.text().catch(() => '');
    if (t) detail = t.slice(0, 500);
  }
  return { ok: false, status: res.status, detail };
}
