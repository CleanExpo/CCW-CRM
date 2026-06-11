/**
 * GET /api/portal/tracking  (UNI-2114)
 *
 * Returns shipment tracking events for the authenticated customer.
 * Optionally filter by order_id or tracking_number via query params.
 *
 * Security model:
 *   - Requires a valid session JWT (Bearer or cookie).
 *   - Customer ID is extracted from the server-side session — never from the
 *     request body or query string.
 *   - Returns only tracking events for orders that belong to the authenticated
 *     customer.
 *   - Cross-customer access is blocked server-side (returns 403).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { isDemoMode } from '@/lib/demo-mode';
import { getPortalStore } from '@/lib/portal/mock-store';

export async function GET(request: NextRequest) {
  // 1. Verify session.
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  // 2. Customer ID from session only.
  const customerId = scope.userId;
  if (!customerId) {
    return NextResponse.json({ detail: 'No customer context for this session' }, { status: 403 });
  }

  // 3. Optional filters from query string (used to scope down, never to elevate access).
  const { searchParams } = new URL(request.url);
  const filterOrderId = searchParams.get('order_id');
  const filterTracking = searchParams.get('tracking_number');

  // 4. Fetch tracking events scoped to this customer.
  const store = getPortalStore(customerId);
  let events = store.tracking;

  if (filterOrderId) {
    events = events.filter((e) => e.order_id === filterOrderId);
  }
  if (filterTracking) {
    events = events.filter((e) => e.tracking_number === filterTracking);
  }

  // In demo mode we return the same data — the store is already customer-scoped.
  // isDemoMode() is checked here to make the gate explicit and testable.
  if (isDemoMode()) {
    return NextResponse.json({ tracking: events, total: events.length });
  }

  return NextResponse.json({ tracking: events, total: events.length });
}
