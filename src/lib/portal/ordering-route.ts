import { NextRequest, NextResponse } from 'next/server';
import { resolvePortalCustomer } from '@/lib/portal/customer-context';
import {
  PORTAL_ORDERING_BLOCKED_CODE,
  PORTAL_ORDERING_BLOCKED_DETAIL,
  PortalOrderError,
  portalOrderingEnabled,
} from '@/lib/portal/my-price';

/**
 * Wraps every UNI-2747 portal route: gate first (409 while shut, before any
 * database read), then the portal customer, then the handler.
 */
export async function withPortalOrdering(
  request: NextRequest,
  handler: (customerId: string) => Promise<NextResponse>
): Promise<NextResponse> {
  if (!portalOrderingEnabled()) {
    return NextResponse.json(
      { code: PORTAL_ORDERING_BLOCKED_CODE, detail: PORTAL_ORDERING_BLOCKED_DETAIL },
      { status: 409 }
    );
  }
  const ctx = await resolvePortalCustomer(request);
  if (!ctx) {
    return NextResponse.json(
      { detail: 'Not authenticated or no customer linked to this account' },
      { status: 401 }
    );
  }
  try {
    return await handler(ctx.customerId);
  } catch (e) {
    if (e instanceof PortalOrderError) {
      return NextResponse.json({ detail: e.message }, { status: e.status });
    }
    return NextResponse.json({ detail: 'Something went wrong' }, { status: 500 });
  }
}
