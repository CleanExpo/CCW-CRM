/**
 * GET /api/portal/orders  (UNI-2114, Prisma wiring PR)
 *
 * Security model:
 *   - Requires a valid session JWT (Bearer or cookie).
 *   - Customer ID is resolved server-side via resolvePortalCustomer (PR #204):
 *     JWT email → Customer row.  Never from request body/query.
 *   - Returns only orders that belong to the authenticated customer.
 *   - Cross-customer isolation is enforced by the Prisma WHERE clause.
 *   - In demo mode (isDemoMode() === true) mock fixture data is returned
 *     via the in-memory store so no DB is required for demos.
 *
 * Production path change (this PR):
 *   - Non-demo requests now query Prisma (Order.customerId = resolvedCustomerId).
 *   - The PortalOrder shape is preserved; see prisma-store.ts for the mapping.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demo-mode';
import { getPortalStore } from '@/lib/portal/mock-store';
import { resolvePortalCustomer } from '@/lib/portal/customer-context';
import { getPortalOrdersFromPrisma } from '@/lib/portal/prisma-store';

export async function GET(request: NextRequest) {
  // 1. Resolve the portal customer from the session JWT.
  //    resolvePortalCustomer handles auth check + email→Customer lookup.
  //    Returns null on 401 (no JWT) or 403 (no matching Customer row).
  const ctx = await resolvePortalCustomer(request);
  if (!ctx) {
    // resolvePortalCustomer returns null for both "no JWT" and "no customer".
    // We return 401 so the client knows to re-authenticate; callers with a
    // valid JWT but no Customer row will need to contact support.
    return NextResponse.json({ detail: 'Not authenticated or no customer account found' }, { status: 401 });
  }

  const { customerId } = ctx;

  // 2. Demo mode: serve fixtures from the in-memory store (no DB needed).
  if (isDemoMode()) {
    const store = getPortalStore(customerId);
    return NextResponse.json({ orders: store.orders, total: store.orders.length });
  }

  // 3. Production path: query Prisma, scoped to this customer only.
  const orders = await getPortalOrdersFromPrisma(customerId);
  return NextResponse.json({ orders, total: orders.length });
}
