/**
 * UNI-2115: GET /api/portal/customer-context
 *
 * Returns the Customer record that belongs to the authenticated portal user.
 * The customer is resolved server-side from the JWT — the client never
 * supplies a customer_id.
 *
 * Used by the usePortalCustomer() hook so portal pages can display account
 * info without any client-side hardcoding.
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolvePortalCustomer } from '@/lib/portal/customer-context';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  const ctx = await resolvePortalCustomer(request);
  if (!ctx) {
    const { requireAuthScope } = await import('@/lib/auth/data-scope');
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json(
      { detail: 'No customer account found for this session' },
      { status: 403 }
    );
  }

  const customer = await prisma.customer.findUnique({
    where: { id: ctx.customerId },
    select: {
      id: true,
      companyName: true,
      contactName: true,
      email: true,
    },
  });

  if (!customer) {
    return NextResponse.json({ detail: 'Customer record not found' }, { status: 404 });
  }

  return NextResponse.json({
    customer_id: customer.id,
    company_name: customer.companyName,
    contact_name: customer.contactName,
    email: customer.email,
  });
}
