import type { NextRequest } from 'next/server';

const SENDGRID_API = 'https://api.sendgrid.com/v3';

export function getSendGridMode(): 'demo' | 'live' {
  return process.env.SENDGRID_MODE === 'demo' ? 'demo' : 'live';
}

export function isSendGridDemoMode(): boolean {
  return getSendGridMode() === 'demo';
}

/** Cookie overrides environment (per-browser testing / overrides). */
export function getSendGridApiKey(request?: NextRequest): string | null {
  const fromCookie = request?.cookies.get('sendgrid_api_key')?.value?.trim();
  const fromEnv = process.env.SENDGRID_API_KEY?.trim();
  return fromCookie || fromEnv || null;
}

export function getSendGridApiKeySource(request?: NextRequest): 'cookie' | 'environment' {
  const fromCookie = request?.cookies.get('sendgrid_api_key')?.value?.trim();
  return fromCookie ? 'cookie' : 'environment';
}

export function getSendGridFromEmail(request?: NextRequest): string | null {
  const v =
    request?.cookies.get('sendgrid_from_email')?.value?.trim() ||
    process.env.SENDGRID_FROM_EMAIL?.trim();
  return v || null;
}

export function getSendGridFromName(request?: NextRequest): string | null {
  const v =
    request?.cookies.get('sendgrid_from_name')?.value?.trim() ||
    process.env.SENDGRID_FROM_NAME?.trim();
  return v || null;
}

export function hasEnvironmentSendGridApiKey(): boolean {
  return Boolean(process.env.SENDGRID_API_KEY?.trim());
}

export type SendMailPayload = {
  to_email: string;
  subject: string;
  body_text: string;
  body_html?: string;
};

export type SendMailResult =
  | { ok: true; message_id: string; mode: 'demo' | 'live' }
  | { ok: false; status: number; detail: string };

/** Validates API key against SendGrid (read-only). */
export async function pingSendGridApi(apiKey: string): Promise<boolean> {
  const res = await fetch(`${SENDGRID_API}/user/profile`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  });
  return res.ok;
}

export async function sendMailViaSendGrid(
  apiKey: string,
  fromEmail: string,
  fromName: string | null,
  payload: SendMailPayload
): Promise<SendMailResult> {
  if (getSendGridMode() === 'demo') {
    return { ok: true, message_id: `demo-${Date.now()}`, mode: 'demo' };
  }

  const content: Array<{ type: string; value: string }> = [
    { type: 'text/plain', value: payload.body_text },
  ];
  if (payload.body_html?.trim()) {
    content.push({ type: 'text/html', value: payload.body_html });
  }

  const body = {
    personalizations: [{ to: [{ email: payload.to_email }] }],
    from: {
      email: fromEmail,
      ...(fromName?.trim() ? { name: fromName.trim() } : {}),
    },
    subject: payload.subject,
    content,
  };

  const res = await fetch(`${SENDGRID_API}/mail/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (res.status === 202 || res.ok) {
    const messageId = res.headers.get('x-message-id') || res.headers.get('X-Message-Id') || '';
    return { ok: true, message_id: messageId || 'accepted', mode: 'live' };
  }

  let detail = `SendGrid HTTP ${res.status}`;
  try {
    const err = (await res.json()) as { errors?: Array<{ message?: string; field?: string }> };
    const parts = err.errors?.map((e) => e.message || e.field).filter(Boolean);
    if (parts?.length) detail = parts.join('; ');
  } catch {
    const text = await res.text().catch(() => '');
    if (text) detail = text.slice(0, 400);
  }
  return { ok: false, status: res.status, detail };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailAddress(email: string): boolean {
  const t = email.trim();
  return t.length > 0 && t.length <= 320 && EMAIL_RE.test(t);
}

/** From address used for API calls (demo falls back when unset). */
export function resolveSendGridFromEmail(request?: NextRequest): string {
  return getSendGridFromEmail(request) || (getSendGridMode() === 'demo' ? 'noreply@demo.local' : '');
}

export type SendGridStatusPayload = {
  connected: boolean;
  /** True when outbound send is allowed (key + verified/demo + from address). */
  can_send: boolean;
  mode: 'demo' | 'live' | 'not_configured';
  from_email: string | null;
  from_name: string | null;
  environment_key_configured: boolean;
  api_key_source: 'cookie' | 'environment' | null;
  api_verified: boolean | null;
  /** True if any SendGrid value is stored in httpOnly cookies for this browser (can clear without changing server env). */
  browser_overrides_active: boolean;
  ai_auto_response_enabled: boolean;
  ai_confidence_threshold: number;
  message: string;
};

function hasSendGridBrowserCookies(request: NextRequest): boolean {
  return ['sendgrid_api_key', 'sendgrid_from_email', 'sendgrid_from_name'].some((name) =>
    Boolean(request.cookies.get(name)?.value?.trim())
  );
}

export type SendGridStatusOverrides = {
  /** Effective API key after a configure save (request cookies are not updated yet). */
  apiKey?: string | null;
  fromEmail?: string | null;
  fromName?: string | null;
  /** Effective key source after configure (cookie wins if a new key was posted). */
  apiKeySource?: 'cookie' | 'environment' | null;
};

/** Shared shape for GET /status and POST /configure responses. */
export async function buildSendGridStatusPayload(
  request: NextRequest,
  overrides?: SendGridStatusOverrides
): Promise<SendGridStatusPayload> {
  const mode = getSendGridMode();
  const apiKey =
    overrides?.apiKey !== undefined ? overrides.apiKey?.trim() || null : getSendGridApiKey(request);
  const fromEmail =
    overrides?.fromEmail !== undefined
      ? overrides.fromEmail
      : getSendGridFromEmail(request);
  const fromName =
    overrides?.fromName !== undefined ? overrides.fromName : getSendGridFromName(request);
  const envKey = hasEnvironmentSendGridApiKey();
  const keySource =
    overrides?.apiKeySource !== undefined
      ? overrides.apiKeySource
      : apiKey
        ? getSendGridApiKeySource(request)
        : null;
  const browserOverrides = hasSendGridBrowserCookies(request);

  if (!apiKey) {
    return {
      connected: false,
      can_send: false,
      mode: 'not_configured',
      from_email: fromEmail,
      from_name: fromName,
      environment_key_configured: envKey,
      api_key_source: null,
      api_verified: null,
      browser_overrides_active: browserOverrides,
      ai_auto_response_enabled: process.env.AI_EMAIL_AUTO_RESPONSE === 'true',
      ai_confidence_threshold: Number(process.env.AI_EMAIL_CONFIDENCE_THRESHOLD || 0.8),
      message:
        'Missing SendGrid API key. Set SENDGRID_API_KEY on the server (for shared testing) or paste a key in Settings → Integrations.',
    };
  }

  let apiVerified: boolean | null = null;
  let message: string;
  if (mode === 'demo') {
    apiVerified = true;
    message = 'Demo mode active (no real email is sent).';
  } else {
    apiVerified = await pingSendGridApi(apiKey);
    if (apiVerified) {
      message =
        keySource === 'environment'
          ? 'SendGrid API key from server environment verified.'
          : 'SendGrid API key verified (saved in this browser).';
    } else {
      message =
        'SendGrid rejected this API key or the profile request failed. Check the key and network access.';
    }
  }

  const effectiveFrom = fromEmail || (mode === 'demo' ? 'noreply@demo.local' : null);
  if (!fromEmail && mode === 'live' && apiVerified === true) {
    message = `${message} Set SENDGRID_FROM_EMAIL or a verified From email below to send mail.`;
  }

  const can_send =
    Boolean(apiKey) &&
    apiVerified === true &&
    Boolean(effectiveFrom) &&
    (mode === 'demo' || Boolean(fromEmail));

  return {
    connected: can_send,
    can_send,
    mode,
    from_email: fromEmail ?? (mode === 'demo' ? effectiveFrom : null),
    from_name: fromName,
    environment_key_configured: envKey,
    api_key_source: keySource,
    api_verified: apiVerified,
    browser_overrides_active: browserOverrides,
    ai_auto_response_enabled: process.env.AI_EMAIL_AUTO_RESPONSE === 'true',
    ai_confidence_threshold: Number(process.env.AI_EMAIL_CONFIDENCE_THRESHOLD || 0.8),
    message,
  };
}

export type SendGridSendReadiness =
  | { ok: true; payload: SendGridStatusPayload }
  | { ok: false; status: number; detail: string; payload: SendGridStatusPayload };

/** Gate outbound send routes on verified key + from address (or demo mode). */
export async function getSendGridSendReadiness(
  request: NextRequest
): Promise<SendGridSendReadiness> {
  const payload = await buildSendGridStatusPayload(request);
  if (payload.can_send) {
    return { ok: true, payload };
  }
  const status =
    payload.mode === 'not_configured' ? 503 : payload.api_verified === false ? 401 : 400;
  return {
    ok: false,
    status,
    detail: payload.message,
    payload,
  };
}
