import {
  allowSendGridBrowserCookieOverrides,
  resolveSendGridCredentials,
  type ResolvedSendGridCredentials,
} from '@/lib/integrations/sendgrid-config';
import { sanitizeSendMailPayload } from '@/lib/integrations/sendgrid-utils';
import type { NextRequest } from 'next/server';

const SENDGRID_API = 'https://api.sendgrid.com/v3';
export {
  isValidEmailAddress,
  sanitizeSendMailPayload,
  SENDGRID_MAX_BODY_LENGTH,
  SENDGRID_MAX_SUBJECT_LENGTH,
} from '@/lib/integrations/sendgrid-utils';

export function getSendGridMode(): 'demo' | 'live' {
  return process.env.SENDGRID_MODE === 'demo' ? 'demo' : 'live';
}

export function isSendGridDemoMode(): boolean {
  return getSendGridMode() === 'demo';
}

/** @deprecated Prefer resolveSendGridCredentials for workspace-aware resolution. */
export function getSendGridApiKey(request?: NextRequest): string | null {
  const fromCookie = allowSendGridBrowserCookieOverrides()
    ? request?.cookies.get('sendgrid_api_key')?.value?.trim()
    : null;
  const fromEnv = process.env.SENDGRID_API_KEY?.trim();
  return fromCookie || fromEnv || null;
}

export function getSendGridApiKeySource(
  request?: NextRequest
): 'cookie' | 'environment' | 'workspace' {
  if (
    allowSendGridBrowserCookieOverrides() &&
    request?.cookies.get('sendgrid_api_key')?.value?.trim()
  ) {
    return 'cookie';
  }
  if (process.env.SENDGRID_API_KEY?.trim()) return 'environment';
  return 'workspace';
}

export function getSendGridFromEmail(request?: NextRequest): string | null {
  const v =
    (allowSendGridBrowserCookieOverrides()
      ? request?.cookies.get('sendgrid_from_email')?.value?.trim()
      : null) || process.env.SENDGRID_FROM_EMAIL?.trim();
  return v || null;
}

export function getSendGridFromName(request?: NextRequest): string | null {
  const v =
    (allowSendGridBrowserCookieOverrides()
      ? request?.cookies.get('sendgrid_from_name')?.value?.trim()
      : null) || process.env.SENDGRID_FROM_NAME?.trim();
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
  template_id?: string;
  dynamic_template_data?: Record<string, unknown>;
  custom_args?: Record<string, string>;
};

export type SendMailResult =
  | { ok: true; message_id: string; mode: 'demo' | 'live' }
  | { ok: false; status: number; detail: string };

/** Validates API key against SendGrid (read-only). Never throws — network/DNS failures return false. */
export async function pingSendGridApi(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${SENDGRID_API}/user/profile`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    // Offline, DNS failure (ENOTFOUND), TLS errors, etc.
    return false;
  }
}

export async function sendMailViaSendGrid(
  apiKey: string,
  fromEmail: string,
  fromName: string | null,
  payload: SendMailPayload
): Promise<SendMailResult> {
  const sanitized = sanitizeSendMailPayload(payload);
  if ('error' in sanitized) {
    return { ok: false, status: 400, detail: sanitized.error };
  }

  if (getSendGridMode() === 'demo') {
    return { ok: true, message_id: `demo-${Date.now()}`, mode: 'demo' };
  }

  const templateId = payload.template_id?.trim();
  const personalizations: Record<string, unknown> = {
    to: [{ email: sanitized.to_email }],
    ...(payload.custom_args ? { custom_args: payload.custom_args } : {}),
  };

  if (templateId && payload.dynamic_template_data) {
    personalizations.dynamic_template_data = payload.dynamic_template_data;
  }

  const body: Record<string, unknown> = {
    personalizations: [personalizations],
    from: {
      email: fromEmail,
      ...(fromName?.trim() ? { name: fromName.trim() } : {}),
    },
  };

  if (templateId) {
    body.template_id = templateId;
  } else {
    const content: Array<{ type: string; value: string }> = [
      { type: 'text/plain', value: sanitized.body_text },
    ];
    if (payload.body_html?.trim()) {
      content.push({ type: 'text/html', value: payload.body_html.trim() });
    }
    body.subject = sanitized.subject;
    body.content = content;
  }

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

export function resolveSendGridFromEmail(
  request?: NextRequest,
  creds?: ResolvedSendGridCredentials
): string {
  return (
    creds?.fromEmail ||
    getSendGridFromEmail(request) ||
    (getSendGridMode() === 'demo' ? 'noreply@demo.local' : '')
  );
}

export type SendGridStatusPayload = {
  connected: boolean;
  can_send: boolean;
  mode: 'demo' | 'live' | 'not_configured';
  from_email: string | null;
  from_name: string | null;
  environment_key_configured: boolean;
  workspace_configured: boolean;
  api_key_source: 'cookie' | 'environment' | 'workspace' | null;
  api_verified: boolean | null;
  browser_overrides_active: boolean;
  browser_overrides_allowed: boolean;
  webhooks_configured: boolean;
  ai_auto_response_enabled: boolean;
  ai_confidence_threshold: number;
  template_id_invoice: string | null;
  template_id_general: string | null;
  message: string;
};

function hasSendGridBrowserCookies(request?: NextRequest): boolean {
  if (!request) return false;
  return ['sendgrid_api_key', 'sendgrid_from_email', 'sendgrid_from_name'].some((name) =>
    Boolean(request.cookies.get(name)?.value?.trim())
  );
}

function isWebhooksConfigured(): boolean {
  return Boolean(
    process.env.SENDGRID_WEBHOOK_SECRET?.trim() ||
    process.env.SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY?.trim() ||
    process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY?.trim()
  );
}

export type SendGridStatusOverrides = {
  apiKey?: string | null;
  fromEmail?: string | null;
  fromName?: string | null;
  apiKeySource?: 'cookie' | 'environment' | 'workspace' | null;
  creds?: ResolvedSendGridCredentials;
};

export async function buildSendGridStatusPayload(
  request?: NextRequest,
  overrides?: SendGridStatusOverrides,
  userId?: string
): Promise<SendGridStatusPayload> {
  const mode = getSendGridMode();
  const creds = overrides?.creds ?? (await resolveSendGridCredentials(request, userId));
  const apiKey = overrides?.apiKey !== undefined ? overrides.apiKey?.trim() || null : creds.apiKey;
  const fromEmail = overrides?.fromEmail !== undefined ? overrides.fromEmail : creds.fromEmail;
  const fromName = overrides?.fromName !== undefined ? overrides.fromName : creds.fromName;
  const envKey = hasEnvironmentSendGridApiKey();
  const keySource =
    overrides?.apiKeySource !== undefined ? overrides.apiKeySource : apiKey ? creds.source : null;
  const browserOverrides = hasSendGridBrowserCookies(request);
  const browserAllowed = allowSendGridBrowserCookieOverrides();

  if (!apiKey) {
    return {
      connected: false,
      can_send: false,
      mode: 'not_configured',
      from_email: fromEmail,
      from_name: fromName,
      environment_key_configured: envKey,
      workspace_configured: creds.workspaceConfigured,
      api_key_source: null,
      api_verified: null,
      browser_overrides_active: browserOverrides,
      browser_overrides_allowed: browserAllowed,
      webhooks_configured: isWebhooksConfigured(),
      ai_auto_response_enabled: process.env.AI_EMAIL_AUTO_RESPONSE === 'true',
      ai_confidence_threshold: Number(process.env.AI_EMAIL_CONFIDENCE_THRESHOLD || 0.8),
      template_id_invoice: creds.templateIdInvoice,
      template_id_general: creds.templateIdGeneral,
      message:
        'Missing SendGrid API key. Set SENDGRID_API_KEY on the server, save workspace credentials in Settings, or paste a key (development only).',
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
          : keySource === 'workspace'
            ? 'SendGrid workspace credentials verified.'
            : 'SendGrid API key verified (saved in this browser).';
    } else {
      message =
        'SendGrid is unreachable or rejected this API key. Check network/DNS access to api.sendgrid.com and the key.';
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
    workspace_configured: creds.workspaceConfigured,
    api_key_source: keySource,
    api_verified: apiVerified,
    browser_overrides_active: browserOverrides,
    browser_overrides_allowed: browserAllowed,
    webhooks_configured: isWebhooksConfigured(),
    ai_auto_response_enabled: process.env.AI_EMAIL_AUTO_RESPONSE === 'true',
    ai_confidence_threshold: Number(process.env.AI_EMAIL_CONFIDENCE_THRESHOLD || 0.8),
    template_id_invoice: creds.templateIdInvoice,
    template_id_general: creds.templateIdGeneral,
    message,
  };
}

export type SendGridSendReadiness =
  | { ok: true; payload: SendGridStatusPayload; creds: ResolvedSendGridCredentials }
  | {
      ok: false;
      status: number;
      detail: string;
      payload: SendGridStatusPayload;
      creds: ResolvedSendGridCredentials;
    };

export async function getSendGridSendReadiness(
  request?: NextRequest,
  userId?: string
): Promise<SendGridSendReadiness> {
  const creds = await resolveSendGridCredentials(request, userId);
  const payload = await buildSendGridStatusPayload(request, { creds }, userId);
  if (payload.can_send) {
    return { ok: true, payload, creds };
  }
  const status =
    payload.mode === 'not_configured' ? 503 : payload.api_verified === false ? 401 : 400;
  return {
    ok: false,
    status,
    detail: payload.message,
    payload,
    creds,
  };
}
