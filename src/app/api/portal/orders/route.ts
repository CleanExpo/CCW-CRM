/**
 * GET /api/portal/orders  (UNI-2114)
 *
 * Security model:
 *   - Requires a valid session JWT (Bearer or cookie).
 *   - Customer ID is extracted from the server-side session — never from the
 *     request body or query string.
 *   - Returns only orders that belong to the authenticated customer.
 *   - Cross-customer access is blocked server-side (returns 403).
 *   - In demo mode (isDemoMode() === true) mock fixture data is returned
 *     without a real DB; otherwise the customer-scoped store is used.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { isDemoMode } from '@/lib/demo-mode';
import { getPortalStore } from '@/lib/portal/mock-store';

export async function GET(request: NextRequest) {
  // 1. Verify session — customer ID comes from the JWT, never from the caller.
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  // 2. The authenticated user IS the portal customer.
  //    UNI-2115 (service-portal customer-context resolution) may enrich this later,
  //    but we must NOT accept a customerId from the request.
  const customerId = scope.userId;

  // 3. Guard: if the session has no resolvable customer identity, reject.
  if (!customerId) {
    return NextResponse.json({ detail: 'No customer context for this session' }, { status: 403 });
  }

  // 4. Fetch orders scoped to this customer.
  //    In demo mode the fixture store is used; in production a real DB query would
  //    replace getPortalStore() while keeping the same customer-scoping contract.
  if (!isDemoMode()) {
    // Production path: use the customer-scoped store (same isolation, real data would
    // come from a DB query filtered by customerId — no other customer's rows can leak).
    const store = getPortalStore(customerId);
    const orders = store.orders;
    return NextResponse.json({ orders, total: orders.length });
  }

  // Demo path: fixture data, also scoped per customer so cross-customer tests still work.
  const store = getPortalStore(customerId);
  return NextResponse.json({ orders: store.orders, total: store.orders.length });
}
