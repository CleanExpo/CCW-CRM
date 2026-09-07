/**
 * SendGrid v3 Mail Send adapter (UNI-2671 A2).
 *
 * Contract verified against the live reference on 2026-09-07
 * (https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send):
 *   POST https://api.sendgrid.com/v3/mail/send
 *   Authorization: Bearer <key>
 *   required body: personalizations[], from{email}, subject
 *   success: 202 Accepted
 *   optional: reply_to, custom_args, categories, mail_settings.sandbox_mode
 *
 * `mail_settings.sandbox_mode` is SendGrid's own dry run: the request is
 * authenticated and validated by SendGrid and no mail is delivered. It is used
 * here in place of a local "demo mode", because a local short-circuit reports
 * success for messages the provider would have rejected — which is how an
 * unusable mail path can look healthy for two months.
 */

import type { MailTransport, OutboundMessage, TransportResult } from '@/lib/email/transport';

const SENDGRID_API = 'https://api.sendgrid.com/v3';

/** Bound the request so a hung provider cannot hang a web request or a cron tick. */
const REQUEST_TIMEOUT_MS = 15_000;

export type SendGridTransportOptions = {
  apiKey: string;
  from: string;
  fromName: string | null;
  replyTo: string | null;
  sandbox: boolean;
  /** Injectable for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
};

/**
 * 4xx means the provider has judged the message and will judge it the same way
 * again; retrying is just a slower failure. 408/429 are the exceptions — those
 * are the provider asking for time, not refusing.
 */
function classify(status: number): 'permanent' | 'transient' {
  if (status === 408 || status === 429) return 'transient';
  if (status >= 500) return 'transient';
  return 'permanent';
}

async function readDetail(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      errors?: Array<{ message?: string; field?: string }>;
    };
    const parts = body.errors?.map((e) => e.message || e.field).filter(Boolean);
    if (parts && parts.length > 0) return parts.join('; ').slice(0, 500);
  } catch {
    // Body was not JSON; fall through to the status-only description.
  }
  return `SendGrid HTTP ${res.status}`;
}

export function createSendGridTransport(options: SendGridTransportOptions): MailTransport {
  const doFetch = options.fetchImpl ?? fetch;

  return {
    name: 'sendgrid',

    async verifyCredentials(): Promise<boolean> {
      try {
        const res = await doFetch(`${SENDGRID_API}/user/profile`, {
          headers: { Authorization: `Bearer ${options.apiKey}` },
          cache: 'no-store',
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        return res.ok;
      } catch {
        // Offline, DNS failure, TLS error, timeout. Unreachable is not verified.
        return false;
      }
    },

    async send(message: OutboundMessage): Promise<TransportResult> {
      const body: Record<string, unknown> = {
        personalizations: [
          {
            to: [{ email: message.to }],
            ...(message.customArgs ? { custom_args: message.customArgs } : {}),
          },
        ],
        from: {
          email: options.from,
          ...(options.fromName ? { name: options.fromName } : {}),
        },
        subject: message.subject,
        content: [
          { type: 'text/plain', value: message.text },
          ...(message.html ? [{ type: 'text/html', value: message.html }] : []),
        ],
        ...(options.replyTo ? { reply_to: { email: options.replyTo } } : {}),
        ...(message.category ? { categories: [message.category] } : {}),
        ...(options.sandbox ? { mail_settings: { sandbox_mode: { enable: true } } } : {}),
      };

      let res: Response;
      try {
        res = await doFetch(`${SENDGRID_API}/mail/send`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (error) {
        // The request never completed, so the provider never judged the message.
        return {
          accepted: false,
          kind: 'transient',
          status: null,
          detail:
            error instanceof Error
              ? `${error.name}: ${error.message}`.slice(0, 500)
              : 'network failure',
        };
      }

      if (res.status === 202) {
        // Documented success. The message id arrives in a response header;
        // when the header is absent the send still happened, so record the
        // acceptance rather than inventing an id or failing a good send.
        const messageId =
          res.headers.get('x-message-id') ?? res.headers.get('X-Message-Id') ?? '';
        return {
          accepted: true,
          providerMessageId: messageId || `accepted-no-id-${Date.now()}`,
          sandboxed: options.sandbox,
        };
      }

      return {
        accepted: false,
        kind: classify(res.status),
        status: res.status,
        detail: await readDetail(res),
      };
    },
  };
}
