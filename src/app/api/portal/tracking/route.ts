/**
 * GET /api/portal/tracking  (UNI-2114 + UNI-2115)
 *
 * Returns shipment tracking for the authenticated portal customer.
 * Optional filters: order_id, tracking_number (scope-down only).
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolvePortalCustomer } from '@/lib/portal/customer-context';
import { getPortalTrackingForCustomer } from '@/lib/portal/portal-data';

export async function GET(request: NextRequest) {
  const ctx = await resolvePortalCustomer(request);
  if (!ctx) {
    return NextResponse.json({ detail: 'Not authenticated or no customer linked to this account' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filterOrderId = searchParams.get('order_id');
  const filterTracking = searchParams.get('tracking_number');

  const tracking = await getPortalTrackingForCustomer(ctx.customerId, {
    orderId: filterOrderId,
    trackingNumber: filterTracking,
  });

  return NextResponse.json({ tracking, total: tracking.length });
}
