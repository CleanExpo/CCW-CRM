/**
 * UNI-2115: Portal service-request route handler tests.
 *
 * Proves:
 * 1. Unauthenticated requests → 401.
 * 2. Authenticated but no matching customer account → 403.
 * 3. Authenticated with a valid customer → can POST and GET their own requests.
 * 4. SPOOF REJECTION: a request whose body carries a customer_id that does NOT
 *    match the session-resolved customer → 403. This is the regression guard
 *    required by UNI-2115.
 * 5. Two different customers are isolated from each other.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { _resetAllPortalStores } from '../service-request-store';

// ─── Mock auth + DB dependencies ─────────────────────────────────────────────

vi.mock('@/lib/auth/data-scope', () => ({
  requireAuthScope: vi.fn(),
}));

vi.mock('@/lib/auth/request-token', () => ({
  getAuthClaimsFromRequest: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    customer: {
      findFirst: vi.fn(),
    },
  },
}));

import { requireAuthScope } from '@/lib/auth/data-scope';
import { getAuthClaimsFromRequest } from '@/lib/auth/request-token';
import { prisma } from '@/lib/db/prisma';
import { GET, POST } from '@/app/api/portal/service-requests/route';

// ─── Type helpers ─────────────────────────────────────────────────────────────

type MockScope = { userId: string; role: 'owner' | 'admin' | 'member' | 'billing'; isAdmin: boolean } | null;

const CUSTOMER_A = { id: 'cust-alpha-uuid', email: 'alice@example.com' };
const CUSTOMER_B = { id: 'cust-beta-uuid', email: 'bob@example.com' };

function setSession(
  scope: MockScope,
  email: string | null = null,
  customerId: string | null = null
) {
  vi.mocked(requireAuthScope).mockResolvedValue(scope);
  vi.mocked(getAuthClaimsFromRequest).mockResolvedValue(
    scope && email
      ? { sub: scope.userId, email, is_admin: false, role: scope.role }
      : null
  );
  vi.mocked(prisma.customer.findFirst).mockResolvedValue(
    customerId ? ({ id: customerId } as never) : null
  );
}

function makeGet(): Request {
  return new Request('http://localhost/api/portal/service-requests', { method: 'GET' });
}

function makePost(body: unknown): Request {
  return new Request('http://localhost/api/portal/service-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Portal service-requests: unauthenticated → 401', () => {
  beforeEach(() => {
    _resetAllPortalStores();
    setSession(null);
  });

  it('GET returns 401 when no JWT', async () => {
    const res = await GET(makeGet() as never);
    expect(res.status).toBe(401);
  });

  it('POST returns 401 when no JWT', async () => {
    const res = await POST(
      makePost({ request_type: 'warranty_claim', description: 'broken unit' }) as never
    );
    expect(res.status).toBe(401);
  });
});

describe('Portal service-requests: authenticated but no customer account → 403', () => {
  beforeEach(() => {
    _resetAllPortalStores();
    // Auth is fine but no Customer row matches the email.
    setSession(
      { userId: 'user-no-cust', role: 'member', isAdmin: false },
      'stranger@example.com',
      null // no matching customer
    );
  });

  it('GET returns 403 when no customer found for email', async () => {
    const res = await GET(makeGet() as never);
    expect(res.status).toBe(403);
  });

  it('POST returns 403 when no customer found for email', async () => {
    const res = await POST(
      makePost({ request_type: 'general_inquiry', description: 'help' }) as never
    );
    expect(res.status).toBe(403);
  });
});

describe('Portal service-requests: happy path', () => {
  beforeEach(() => {
    _resetAllPortalStores();
    setSession(
      { userId: 'user-alice', role: 'member', isAdmin: false },
      CUSTOMER_A.email,
      CUSTOMER_A.id
    );
  });

  it('POST creates a request and returns 201 with a reference number', async () => {
    const res = await POST(
      makePost({
        request_type: 'warranty_claim',
        description: 'The motor seized after 3 months.',
        order_id: 'ORD-2026-0001',
        product_sku: 'TM-PRO-570',
        preferred_contact: 'email',
      }) as never
    );
    expect(res.status).toBe(201);
    const body = await res.json() as {
      request_id: string;
      customer_id: string;
      reference_number: string;
      status: string;
    };
    expect(body.customer_id).toBe(CUSTOMER_A.id);
    expect(body.reference_number).toMatch(/^SR-\d{4}-\d{4}$/);
    expect(body.status).toBe('submitted');
  });

  it('GET lists created requests for the session customer', async () => {
    // Create one first
    await POST(
      makePost({ request_type: 'general_inquiry', description: 'Any spare parts?' }) as never
    );

    const res = await GET(makeGet() as never);
    expect(res.status).toBe(200);
    const body = await res.json() as { requests: Array<{ customer_id: string }>; total: number };
    expect(body.total).toBe(1);
    expect(body.requests[0].customer_id).toBe(CUSTOMER_A.id);
  });

  it('POST returns 400 when description is missing', async () => {
    const res = await POST(
      makePost({ request_type: 'general_inquiry', description: '   ' }) as never
    );
    expect(res.status).toBe(400);
  });

  it('POST returns 400 when request_type is invalid', async () => {
    const res = await POST(
      makePost({ request_type: 'hack_the_planet', description: 'valid text' }) as never
    );
    expect(res.status).toBe(400);
  });
});

// ─── UNI-2115 primary acceptance criterion: spoof rejection ──────────────────

describe('UNI-2115 spoof rejection: forged customer_id in body → 403', () => {
  beforeEach(() => {
    _resetAllPortalStores();
    // Session resolves to CUSTOMER_A
    setSession(
      { userId: 'user-alice', role: 'member', isAdmin: false },
      CUSTOMER_A.email,
      CUSTOMER_A.id
    );
  });

  it('POST with body.customer_id = session customer is accepted (200-class)', async () => {
    // Attacker who knows their own id sends it explicitly — should be fine.
    const res = await POST(
      makePost({
        customer_id: CUSTOMER_A.id, // matches session → OK
        request_type: 'general_inquiry',
        description: 'Correct claim',
      }) as never
    );
    expect(res.status).toBe(201);
  });

  it('POST with body.customer_id = a DIFFERENT customer is rejected with 403', async () => {
    // Core regression test for UNI-2115: a caller supplies a forged
    // customer_id belonging to a different customer in the body.
    // The backend must detect the mismatch and refuse.
    const res = await POST(
      makePost({
        customer_id: CUSTOMER_B.id, // FORGED — does NOT match session
        request_type: 'warranty_claim',
        description: 'Spoofed request attempting to act as another customer',
      }) as never
    );
    expect(res.status).toBe(403);
    const body = await res.json() as { detail: string };
    expect(body.detail).toContain('customer_id');
  });

  it('POST with body.customer_id = arbitrary string is rejected with 403', async () => {
    const res = await POST(
      makePost({
        customer_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        request_type: 'service_booking',
        description: 'Injected arbitrary customer id',
      }) as never
    );
    expect(res.status).toBe(403);
  });
});

// ─── Customer isolation ───────────────────────────────────────────────────────

describe('Portal service-requests: customers are isolated from each other', () => {
  beforeEach(() => {
    _resetAllPortalStores();
  });

  it('CUSTOMER_A cannot read CUSTOMER_B requests via GET', async () => {
    // CUSTOMER_B creates a request
    setSession(
      { userId: 'user-bob', role: 'member', isAdmin: false },
      CUSTOMER_B.email,
      CUSTOMER_B.id
    );
    await POST(
      makePost({ request_type: 'general_inquiry', description: 'Bob only' }) as never
    );

    // CUSTOMER_A now requests their list — must not see Bob's entry
    setSession(
      { userId: 'user-alice', role: 'member', isAdmin: false },
      CUSTOMER_A.email,
      CUSTOMER_A.id
    );
    const res = await GET(makeGet() as never);
    expect(res.status).toBe(200);
    const body = await res.json() as { requests: unknown[]; total: number };
    expect(body.total).toBe(0);
    expect(body.requests).toHaveLength(0);
  });
});
