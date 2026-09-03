import { createHash, randomBytes } from 'node:crypto';

export const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createInviteToken(): { token: string; hash: string; expiresAt: Date } {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    hash: hashInviteToken(token),
    expiresAt: new Date(Date.now() + INVITE_TOKEN_TTL_MS),
  };
}

export function inviteAcceptUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '').replace(/\/$/, '');
  const path = `/invite/accept?token=${encodeURIComponent(token)}`;
  return base ? `${base}${path}` : path;
}
