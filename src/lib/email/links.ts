/**
 * Absolute URLs for links that leave the application (UNI-2671).
 *
 * A relative path in an email is a dead link, and a link built from a
 * request-supplied Host header is a password-reset poisoning vector: an
 * attacker who can set `Host` gets the victim's reset token delivered to their
 * own domain. So the base comes from configuration only, and when it is absent
 * this module says so rather than guessing.
 */

/**
 * Resolve the public base URL, or null when it cannot be known.
 *
 * `NEXT_PUBLIC_APP_URL` is the repository's existing convention. `VERCEL_URL`
 * is accepted as a preview-deployment fallback because Vercel sets it itself —
 * it is not attacker-controlled the way a request header is.
 */
export function resolvePublicBaseUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, '')}`;

  return null;
}

export class MissingBaseUrlError extends Error {
  constructor() {
    super(
      'NEXT_PUBLIC_APP_URL is not set, so no absolute link can be built for an outbound email.'
    );
    this.name = 'MissingBaseUrlError';
  }
}

/** Build an absolute app URL, throwing rather than emitting a broken link. */
export function appUrl(path: string, params?: Record<string, string>): string {
  const base = resolvePublicBaseUrl();
  if (!base) throw new MissingBaseUrlError();

  const url = new URL(path.startsWith('/') ? path : `/${path}`, `${base}/`);
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function passwordResetUrl(token: string): string {
  return appUrl('/reset-password', { token });
}

/**
 * The invitation link is the password-reset flow: the invitee sets their own
 * password rather than being sent one. Nothing has to carry a credential.
 */
export function invitationAcceptUrl(token: string): string {
  return appUrl('/reset-password', { token, invited: '1' });
}
