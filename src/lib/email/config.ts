/**
 * Optix transactional email — configuration, fail-closed (UNI-2671).
 *
 * Outbound email has been dead since July because a provisioning request was
 * closed on the assumption that it was already done, and nothing ever proved
 * otherwise. The rule this module enforces is therefore narrow and absolute:
 *
 *   the only way to reach a `configured` state is for the values to be present,
 *   and the only way to reach `authenticated` is for SendGrid to have answered.
 *
 * There is no branch that invents a default, and no branch that treats absence
 * as acceptable. `EMAIL_ENABLED` defaults to OFF, so a deploy that has never
 * been told to send cannot send.
 */

/** Every environment variable this module reads. Named here so the audit is one grep. */
export const EMAIL_ENV_VARS = [
  'EMAIL_ENABLED',
  'SENDGRID_API_KEY',
  'EMAIL_FROM',
  'EMAIL_FROM_NAME',
  'EMAIL_REPLY_TO',
  'EMAIL_SANDBOX',
] as const;

/**
 * The decided sending identity (UNI-2671, resolved by Phill 2026-09-07):
 * authenticate `optix.ccwarehouse.com.au`, send as `noreply@` on that subdomain.
 * This is documentation, NOT a default — nothing falls back to it. A deployment
 * that has not set EMAIL_FROM is `unconfigured` and refuses to send.
 */
export const APPROVED_SENDING_IDENTITY = 'noreply@optix.ccwarehouse.com.au';

export type EmailConfigStatus = 'unconfigured' | 'configured';

/**
 * Resolved config. The API key is present ONLY on the `configured` variant and
 * is never included in anything this module returns for display or logging —
 * see `describeEmailConfig`.
 */
export type EmailConfig =
  | {
      status: 'unconfigured';
      enabled: boolean;
      /** Which required values are absent. Names only, never values. */
      missing: string[];
      reason: string;
    }
  | {
      status: 'configured';
      enabled: boolean;
      apiKey: string;
      from: string;
      fromName: string | null;
      replyTo: string | null;
      /**
       * SendGrid's own sandbox: the request is sent, authenticated and
       * validated by SendGrid, and no mail is delivered. This is a REAL
       * round trip — unlike a local "demo mode", it cannot report success
       * for a provider that would have rejected the message.
       */
      sandbox: boolean;
    };

/** Public, redacted view of the config. Safe to serialise into a health payload. */
export type EmailConfigDescription = {
  status: EmailConfigStatus;
  enabled: boolean;
  sandbox: boolean;
  /** The From address is not a secret and is the value operators most need to see. */
  from: string | null;
  from_name: string | null;
  reply_to: string | null;
  /** Names of required env vars that are absent. Never values. */
  missing: string[];
  /** True when the configured From matches the identity approved in UNI-2671. */
  from_matches_approved_identity: boolean;
};

function trimmed(name: string): string | null {
  const v = process.env[name];
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * `EMAIL_ENABLED` is opt-in and strict: only the exact string `true` enables
 * sending. `1`, `yes`, `TRUE` and a stray space all mean OFF, because a flag
 * that guesses at intent is not a flag.
 */
export function isEmailEnabled(): boolean {
  return process.env.EMAIL_ENABLED === 'true';
}

function isSandbox(): boolean {
  return process.env.EMAIL_SANDBOX === 'true';
}

/**
 * Resolve the email configuration.
 *
 * Legacy `SENDGRID_FROM_EMAIL` / `SENDGRID_FROM_NAME` are accepted as a
 * fallback so that the already-working invoice and workflow senders do not
 * regress the moment this module lands. `EMAIL_FROM` wins where both are set.
 */
export function resolveEmailConfig(): EmailConfig {
  const enabled = isEmailEnabled();
  const apiKey = trimmed('SENDGRID_API_KEY');
  const from = trimmed('EMAIL_FROM') ?? trimmed('SENDGRID_FROM_EMAIL');

  const missing: string[] = [];
  if (!apiKey) missing.push('SENDGRID_API_KEY');
  if (!from) missing.push('EMAIL_FROM');

  if (missing.length > 0) {
    return {
      status: 'unconfigured',
      enabled,
      missing,
      reason: `Transactional email is not configured: ${missing.join(', ')} ${
        missing.length === 1 ? 'is' : 'are'
      } not set. No mail can be sent and none will be reported as sent.`,
    };
  }

  return {
    status: 'configured',
    enabled,
    apiKey: apiKey as string,
    from: from as string,
    fromName: trimmed('EMAIL_FROM_NAME') ?? trimmed('SENDGRID_FROM_NAME'),
    replyTo: trimmed('EMAIL_REPLY_TO'),
    sandbox: isSandbox(),
  };
}

/** Redacted description of the current config. Contains no credential material. */
export function describeEmailConfig(
  config: EmailConfig = resolveEmailConfig()
): EmailConfigDescription {
  if (config.status === 'unconfigured') {
    return {
      status: 'unconfigured',
      enabled: config.enabled,
      sandbox: isSandbox(),
      from: null,
      from_name: null,
      reply_to: null,
      missing: config.missing,
      from_matches_approved_identity: false,
    };
  }
  return {
    status: 'configured',
    enabled: config.enabled,
    sandbox: config.sandbox,
    from: config.from,
    from_name: config.fromName,
    reply_to: config.replyTo,
    missing: [],
    from_matches_approved_identity:
      config.from.toLowerCase() === APPROVED_SENDING_IDENTITY.toLowerCase(),
  };
}
