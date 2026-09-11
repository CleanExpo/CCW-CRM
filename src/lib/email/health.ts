/**
 * Truthful email health (UNI-2671 A1).
 *
 * Three states, and the difference between the last two is the whole point:
 *
 *   unconfigured  — required values are absent. Nothing can be sent.
 *   configured    — the values are present. NOBODY HAS ASKED SENDGRID.
 *   authenticated — SendGrid answered and accepted the credential.
 *
 * The July failure was exactly the gap between the second and the third: the
 * settings looked done, so the request was closed, and no one asked the
 * provider. `configured` therefore never rounds up.
 *
 * The verification is a network call, and `/api/health` is public and
 * unauthenticated, so the result is cached and the probe is rate-limited. An
 * expired cache reports `configured` with `verified: null` — never a stale
 * `authenticated`.
 */

import { describeEmailConfig, resolveEmailConfig, type EmailConfig } from '@/lib/email/config';
import { transportFor } from '@/lib/email/mailer';
import type { MailTransport } from '@/lib/email/transport';

export type EmailHealthState = 'unconfigured' | 'configured' | 'authenticated';

export type EmailHealth = {
  state: EmailHealthState;
  enabled: boolean;
  sandbox: boolean;
  from: string | null;
  from_name: string | null;
  reply_to: string | null;
  /** Names of absent required env vars. Never values. */
  missing: string[];
  from_matches_approved_identity: boolean;
  /** true verified, false rejected/unreachable, null not probed in this window. */
  verified: boolean | null;
  /** When the cached verification was taken. Null when never probed. */
  verified_at: string | null;
  message: string;
};

/** How long a successful or failed probe is trusted before it is taken again. */
const PROBE_TTL_MS = 5 * 60_000;

type CacheEntry = { verified: boolean; at: number };
let cache: CacheEntry | null = null;

/** Test seam. Not exported from the module index. */
export function __resetEmailHealthCache(): void {
  cache = null;
}

export type EmailHealthOptions = {
  config?: EmailConfig;
  transport?: MailTransport;
  /**
   * Whether to make the network call. Defaults to `EMAIL_ENABLED`, so a
   * deployment that has never switched sending on issues no outbound request
   * from a health check. When false, a cold cache reports `configured` with
   * `verified: null` rather than guessing.
   */
  probe?: boolean;
  now?: number;
};

export async function getEmailHealth(options?: EmailHealthOptions): Promise<EmailHealth> {
  const config = options?.config ?? resolveEmailConfig();
  const described = describeEmailConfig(config);
  const now = options?.now ?? Date.now();

  const base = {
    enabled: described.enabled,
    sandbox: described.sandbox,
    from: described.from,
    from_name: described.from_name,
    reply_to: described.reply_to,
    missing: described.missing,
    from_matches_approved_identity: described.from_matches_approved_identity,
  };

  if (config.status === 'unconfigured') {
    return {
      ...base,
      state: 'unconfigured',
      verified: null,
      verified_at: null,
      message: config.reason,
    };
  }

  const fresh = cache && now - cache.at < PROBE_TTL_MS ? cache : null;
  let entry: CacheEntry | null = fresh;

  if (!entry && (options?.probe ?? config.enabled)) {
    const transport = options?.transport ?? transportFor(config);
    if (transport) {
      entry = { verified: await transport.verifyCredentials(), at: now };
      cache = entry;
    }
  }

  if (!entry) {
    return {
      ...base,
      state: 'configured',
      verified: null,
      verified_at: null,
      message:
        'SendGrid credentials are present but have not been verified in this window. Present is not the same as working — this is the state that let outbound email stay dead since July.',
    };
  }

  if (!entry.verified) {
    return {
      ...base,
      state: 'configured',
      verified: false,
      verified_at: new Date(entry.at).toISOString(),
      message:
        'SendGrid rejected the credential or was unreachable. Email is configured but NOT authenticated; no mail will be delivered.',
    };
  }

  const notes: string[] = ['SendGrid accepted the credential.'];
  if (!described.enabled) {
    notes.push('EMAIL_ENABLED is not "true", so sending is still switched off.');
  }
  if (!described.from_matches_approved_identity) {
    notes.push(
      `The From address is not the identity approved in UNI-2671 (noreply@optix.ccwarehouse.com.au).`
    );
  }
  if (described.sandbox) {
    notes.push('EMAIL_SANDBOX is on: messages are validated by SendGrid and not delivered.');
  }

  return {
    ...base,
    state: 'authenticated',
    verified: true,
    verified_at: new Date(entry.at).toISOString(),
    message: notes.join(' '),
  };
}
