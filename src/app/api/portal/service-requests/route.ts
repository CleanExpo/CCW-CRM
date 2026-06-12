/**
 * UNI-2115: Portal service-request endpoints.
 *
 * Security model (same shape as UNI-2107 / requireAuthScope):
 * 1. Verify the access JWT → identify the user.
 * 2. Resolve the Customer record server-side from the JWT email.
 * 3. NEVER accept a customer_id from the request body / query string.
 *    Any body field named `customer_id` that does NOT match the session
 *    customer triggers a 403.
 *
 * GET  /api/portal/service-requests  → list requests for the session customer
 * POST /api/portal/service-requests  → create a new request for the session customer
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolvePortalCustomer, customerIdMatchesSession } from '@/lib/portal/customer-context';
import {
  getRequestsForCustomer,
  createRequest,
  type PortalRequestType,
} from '@/lib/portal/service-request-store';

const VALID_REQUEST_TYPES = new Set<PortalRequestType>([
  'warranty_claim',
  'service_booking',
  'general_inquiry',
]);

export async function GET(request: NextRequest) {
  const ctx = await resolvePortalCustomer(request);
  if (!ctx) {
    // Distinguish: null because unauthenticated vs. no matching customer.
    // resolvePortalCustomer returns null for both; we re-check the JWT here
    // to give the right status code.
    const { requireAuthScope } = await import('@/lib/auth/data-scope');
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json({ detail: 'No customer account found for this session' }, { status: 403 });
  }

  const requests = getRequestsForCustomer(ctx.customerId);
  return NextResponse.json({ requests, total: requests.length });
}

export async function POST(request: NextRequest) {
  const ctx = await resolvePortalCustomer(request);
  if (!ctx) {
    const { requireAuthScope } = await import('@/lib/auth/data-scope');
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json({ detail: 'No customer account found for this session' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON body' }, { status: 400 });
  }

  // UNI-2115 spoof-rejection: if the caller includes a customer_id claim in
  // the body it must match the session-resolved customer. Mismatch → 403.
  if (body.customer_id !== undefined && body.customer_id !== null) {
    if (!customerIdMatchesSession(ctx, String(body.customer_id))) {
      return NextResponse.json(
        { detail: 'Forbidden: customer_id does not match authenticated session' },
        { status: 403 }
      );
    }
  }

  const rawType = String(body.request_type ?? '');
  if (!VALID_REQUEST_TYPES.has(rawType as PortalRequestType)) {
    return NextResponse.json(
      {
        detail: `Invalid request_type. Must be one of: ${[...VALID_REQUEST_TYPES].join(', ')}`,
      },
      { status: 400 }
    );
  }

  const description = String(body.description ?? '').trim();
  if (!description) {
    return NextResponse.json({ detail: 'description is required' }, { status: 400 });
  }

  const created = createRequest(ctx.customerId, {
    request_type: rawType as PortalRequestType,
    description,
    order_id: body.order_id ? String(body.order_id) : null,
    product_sku: body.product_sku ? String(body.product_sku) : null,
    preferred_contact: String(body.preferred_contact ?? 'email'),
  });

  return NextResponse.json(created, { status: 201 });
}
