/**
 * UNI-2115: Portal customer-context resolution.
 *
 * Resolves the Customer record that belongs to the authenticated portal user.
 * The customer is looked up server-side by matching the JWT email against the
 * Customer.email column — the caller never trusts a client-supplied customer_id.
 *
 * Pattern mirrors requireAuthScope (UNI-2107): call from any /api/portal/* route
 * handler after verifying the JWT. The resolved customer_id can then be used to
 * scope all data operations.
 */

import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import type { NextRequest } from 'next/server';

export type PortalCustomerContext = {
  /** The JWT subject (AppUser.id). */
  userId: string;
  /** The authenticated user's email (from JWT claims). */
  email: string;
  /** The Customer row whose email matches the authenticated user's email. */
  customerId: string;
};

/**
 * Resolve the portal customer for the current request.
 *
 * Returns null when:
 * - The request carries no valid JWT (→ 401)
 * - No Customer row matches the session email (→ 403)
 *
 * Never accepts a customer_id from the request body / query string.
 */
export async function resolvePortalCustomer(
  request: NextRequest
): Promise<PortalCustomerContext | null> {
  const scope = await requireAuthScope(request);
  if (!scope) return null;

  // The JWT claims carry the user's email via the `email` field baked in at
  // login (see jwt-tokens.ts). Re-derive it from the raw token so we stay
  // consistent with the existing token shape.
  const { getAuthClaimsFromRequest } = await import('@/lib/auth/request-token');
  const claims = await getAuthClaimsFromRequest(request);
  if (!claims?.email) return null;

  const customer = await prisma.customer.findFirst({
    where: { email: claims.email.toLowerCase(), isActive: true },
    select: { id: true },
  });

  if (!customer) return null;

  return {
    userId: scope.userId,
    email: claims.email.toLowerCase(),
    customerId: customer.id,
  };
}

/**
 * Verify that `claimedCustomerId` matches the session-resolved customer.
 *
 * Returns false (→ 403 Forbidden) when the claimed id doesn't match.
 * This guards against a caller constructing a body with an arbitrary customer_id.
 */
export function customerIdMatchesSession(
  ctx: PortalCustomerContext,
  claimedCustomerId: string
): boolean {
  return ctx.customerId === claimedCustomerId;
}
