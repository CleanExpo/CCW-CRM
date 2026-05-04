import type { NextRequest } from 'next/server';
import { getAuthClaimsFromRequest } from '@/lib/auth/request-token';

export type AuthScope = {
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'billing';
  isAdmin: boolean;
};

export async function requireAuthScope(request: NextRequest): Promise<AuthScope | null> {
  const claims = await getAuthClaimsFromRequest(request);
  if (!claims) return null;
  return {
    userId: claims.sub,
    role: claims.role,
    isAdmin: claims.is_admin,
  };
}

/**
 * Same as {@link requireAuthScope}, but allows server cron jobs that send
 * `Authorization: Bearer ${CRON_SECRET}` and set `CRON_INTEGRATION_USER_ID`
 * to an existing app user id (tenant owner for Cin7 / Shopify order imports).
 */
export async function requireAuthScopeOrCronIntegrationJob(
  request: NextRequest
): Promise<AuthScope | null> {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get('authorization');
  if (secret && auth === `Bearer ${secret}`) {
    const uid = process.env.CRON_INTEGRATION_USER_ID?.trim();
    if (!uid) return null;
    return { userId: uid, role: 'owner', isAdmin: true };
  }
  return requireAuthScope(request);
}

/** Logged-in user, or a trusted cron call with `Authorization: Bearer ${CRON_SECRET}`. */
export async function requireAuthenticatedUserOrCron(
  request: NextRequest
): Promise<boolean> {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && request.headers.get('authorization') === `Bearer ${secret}`) {
    return true;
  }
  return (await requireAuthScope(request)) !== null;
}
