/**
 * GET /api/portal/orders  (UNI-2114 + UNI-2115)
 *
 * Customer is resolved server-side via JWT email -> Customer row.
 * Data comes from Prisma Order tables; demo fixtures used only when demo mode
 * and no DB rows exist for the customer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolvePortalCustomer } from '@/lib/portal/customer-context';
import { getPortalOrdersForCustomer } from '@/lib/portal/portal-data';

export async function GET(request: NextRequest) {
  const ctx = await resolvePortalCustomer(request);
  if (!ctx) {
    return NextResponse.json({ detail: 'Not authenticated or no customer linked to this account' }, { status: 401 });
  }

  const orders = await getPortalOrdersForCustomer(ctx.customerId);
  return NextResponse.json({ orders, total: orders.length });
}
