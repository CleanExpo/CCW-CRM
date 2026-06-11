/**
 * GET /api/portal/tracking  (UNI-2114, Prisma wiring PR)
 *
 * Returns shipment tracking events for the authenticated customer.
 * Optionally filter by order_id or tracking_number via query params.
 *
 * Security model:
 *   - Requires a valid session JWT (Bearer or cookie).
 *   - Customer ID is resolved server-side via resolvePortalCustomer (PR #204).
 *   - Returns only tracking events for orders that belong to the authenticated customer.
 *   - Cross-customer access is blocked server-side.
 *
 * Schema gap (documented for Rana):
 *   SalesFulfilment has no FK to Customer or Order in the current Prisma schema.
 *   The production Prisma path returns an empty tracking array until a schema
 *   migration adds `orderId` (UUID FK → Order) to SalesFulfilment.
 *   Demo mode still serves full fixture tracking events.
 *   See PR body for the recommended migration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demo-mode';
import { getPortalStore } from '@/lib/portal/mock-store';
import { resolvePortalCustomer } from '@/lib/portal/customer-context';
import { getPortalTrackingFromPrisma } from '@/lib/portal/prisma-store';

export async function GET(request: NextRequest) {
  // 1. Resolve the portal customer from the session JWT.
  const ctx = await resolvePortalCustomer(request);
  if (!ctx) {
    return NextResponse.json({ detail: 'Not authenticated or no customer account found' }, { status: 401 });
  }

  const { customerId } = ctx;

  // 2. Optional filters from query string (used to scope down, never to elevate access).
  const { searchParams } = new URL(request.url);
  const filterOrderId = searchParams.get('order_id') ?? undefined;
  const filterTracking = searchParams.get('tracking_number') ?? undefined;

  // 3. Demo mode: serve fixtures from the in-memory store.
  if (isDemoMode()) {
    const store = getPortalStore(customerId);
    let events = store.tracking;
    if (filterOrderId) events = events.filter((e) => e.order_id === filterOrderId);
    if (filterTracking) events = events.filter((e) => e.tracking_number === filterTracking);
    return NextResponse.json({ tracking: events, total: events.length });
  }

  // 4. Production path: query Prisma (currently returns [] — see schema gap above).
  const events = await getPortalTrackingFromPrisma(customerId, {
    orderId: filterOrderId,
    trackingNumber: filterTracking,
  });
  return NextResponse.json({ tracking: events, total: events.length });
}
