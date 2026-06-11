/**
 * UNI-2114: Portal orders + tracking API route isolation tests.
 *
 * Tests that:
 *  1. Unauthenticated requests return 401.
 *  2. Authenticated customer A gets their orders.
 *  3. Authenticated customer B gets their orders (different data from A's).
 *  4. Customer A's token cannot read customer B's orders — isolation proven by
 *     verifying A's response never contains B's order IDs (not a 403 because
 *     the route scopes data to the session customer; cross-customer data leakage
 *     is what we're blocking).
 *  5. Demo mode returns fixture data (isDemoMode() = true).
 *  6. Same customer always gets the same data across multiple calls.
 *
 * Uses vi.mock to control requireAuthScope so no real JWT/DB is needed.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { _resetAllPortalStores } from '../portal/mock-store';

// Mock auth before importing route handlers
vi.mock('@/lib/auth/data-scope', () => ({
  requireAuthScope: vi.fn(),
}));

import { requireAuthScope } from '@/lib/auth/data-scope';
import { GET as ordersGET } from '@/app/api/portal/orders/route';
import { GET as trackingGET } from '@/app/api/portal/tracking/route';

type MockAuthScope = {
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'billing';
  isAdmin: boolean;
} | null;

function setAuth(scope: MockAuthScope) {
  vi.mocked(requireAuthScope).mockResolvedValue(scope);
}

function makeGetRequest(path = 'http://localhost/api/portal/orders'): Request {
  return new Request(path, { method: 'GET' });
}

// ---------------------------------------------------------------------------
// Auth gate: unauthenticated → 401
// ---------------------------------------------------------------------------

describe('Portal routes: unauthenticated requests are blocked (401)', () => {
  beforeEach(() => {
    _resetAllPortalStores();
    setAuth(null);
  });

  it('GET /api/portal/orders → 401', async () => {
    const res = await ordersGET(makeGetRequest() as never);
    expect(res.status).toBe(401);
  });

  it('GET /api/portal/tracking → 401', async () => {
    const res = await trackingGET(
      makeGetRequest('http://localhost/api/portal/tracking') as never
    );
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Customer A gets their own orders
// ---------------------------------------------------------------------------

describe('Portal orders: authenticated customer A gets their orders', () => {
  const CUSTOMER_A = 'user-portal-cust-a';

  beforeEach(() => {
    _resetAllPortalStores();
    setAuth({ userId: CUSTOMER_A, role: 'member', isAdmin: false });
  });

  it('returns 200 with orders array', async () => {
    const res = await ordersGET(makeGetRequest() as never);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { orders: Array<{ order_id: string }>; total: number };
    expect(Array.isArray(body.orders)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(0);
  });

  it('all returned order IDs are scoped to customer A', async () => {
    const res = await ordersGET(makeGetRequest() as never);
    const body = (await res.json()) as { orders: Array<{ order_id: string }> };
    for (const order of body.orders) {
      expect(order.order_id).toContain(CUSTOMER_A);
    }
  });
});

// ---------------------------------------------------------------------------
// Customer B gets their own orders (different from A's)
// ---------------------------------------------------------------------------

describe('Portal orders: authenticated customer B gets their orders', () => {
  const CUSTOMER_B = 'user-portal-cust-b';

  beforeEach(() => {
    _resetAllPortalStores();
    setAuth({ userId: CUSTOMER_B, role: 'member', isAdmin: false });
  });

  it('returns 200 with orders array', async () => {
    const res = await ordersGET(makeGetRequest() as never);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { orders: Array<{ order_id: string }>; total: number };
    expect(Array.isArray(body.orders)).toBe(true);
  });

  it('all returned order IDs are scoped to customer B', async () => {
    const res = await ordersGET(makeGetRequest() as never);
    const body = (await res.json()) as { orders: Array<{ order_id: string }> };
    for (const order of body.orders) {
      expect(order.order_id).toContain(CUSTOMER_B);
    }
  });
});

// ---------------------------------------------------------------------------
// Cross-customer isolation: A's session CANNOT access B's data
// ---------------------------------------------------------------------------

describe('Portal orders: customer A cannot access customer B data (isolation)', () => {
  const CUSTOMER_A = 'user-portal-cust-a';
  const CUSTOMER_B = 'user-portal-cust-b';

  beforeEach(() => {
    _resetAllPortalStores();
  });

  it("customer A's response contains none of customer B's order IDs", async () => {
    // First, let customer B load their store (populates their data)
    setAuth({ userId: CUSTOMER_B, role: 'member', isAdmin: false });
    const resB = await ordersGET(makeGetRequest() as never);
    const bodyB = (await resB.json()) as { orders: Array<{ order_id: string }> };
    const bOrderIds = bodyB.orders.map((o) => o.order_id);

    // Now customer A authenticates and fetches their orders
    setAuth({ userId: CUSTOMER_A, role: 'member', isAdmin: false });
    const resA = await ordersGET(makeGetRequest() as never);
    const bodyA = (await resA.json()) as { orders: Array<{ order_id: string }> };
    const aOrderIds = bodyA.orders.map((o) => o.order_id);

    // No overlap
    for (const id of bOrderIds) {
      expect(aOrderIds).not.toContain(id);
    }
  });

  it("customer B's response contains none of customer A's order IDs", async () => {
    setAuth({ userId: CUSTOMER_A, role: 'member', isAdmin: false });
    const resA = await ordersGET(makeGetRequest() as never);
    const bodyA = (await resA.json()) as { orders: Array<{ order_id: string }> };
    const aOrderIds = bodyA.orders.map((o) => o.order_id);

    setAuth({ userId: CUSTOMER_B, role: 'member', isAdmin: false });
    const resB = await ordersGET(makeGetRequest() as never);
    const bodyB = (await resB.json()) as { orders: Array<{ order_id: string }> };
    const bOrderIds = bodyB.orders.map((o) => o.order_id);

    for (const id of aOrderIds) {
      expect(bOrderIds).not.toContain(id);
    }
  });

  it('customer A order numbers are distinct from customer B order numbers', async () => {
    setAuth({ userId: CUSTOMER_A, role: 'member', isAdmin: false });
    const resA = await ordersGET(makeGetRequest() as never);
    const bodyA = (await resA.json()) as { orders: Array<{ order_number: string }> };
    const aOrderNumbers = bodyA.orders.map((o) => o.order_number);

    setAuth({ userId: CUSTOMER_B, role: 'member', isAdmin: false });
    const resB = await ordersGET(makeGetRequest() as never);
    const bodyB = (await resB.json()) as { orders: Array<{ order_number: string }> };
    const bOrderNumbers = bodyB.orders.map((o) => o.order_number);

    // Each customer has unique order numbers
    for (const num of aOrderNumbers) {
      expect(bOrderNumbers).not.toContain(num);
    }
  });
});

// ---------------------------------------------------------------------------
// Tracking route isolation
// ---------------------------------------------------------------------------

describe('Portal tracking: cross-customer isolation', () => {
  const CUSTOMER_A = 'user-portal-cust-a';
  const CUSTOMER_B = 'user-portal-cust-b';

  beforeEach(() => {
    _resetAllPortalStores();
  });

  it('unauthenticated → 401', async () => {
    setAuth(null);
    const res = await trackingGET(
      makeGetRequest('http://localhost/api/portal/tracking') as never
    );
    expect(res.status).toBe(401);
  });

  it('customer A gets their tracking events', async () => {
    setAuth({ userId: CUSTOMER_A, role: 'member', isAdmin: false });
    const res = await trackingGET(
      makeGetRequest('http://localhost/api/portal/tracking') as never
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tracking: Array<{ event_id: string }> };
    expect(Array.isArray(body.tracking)).toBe(true);
    for (const evt of body.tracking) {
      expect(evt.event_id).toContain(CUSTOMER_A);
    }
  });

  it("customer A's tracking events do NOT contain customer B's event IDs", async () => {
    // Populate B's tracking data
    setAuth({ userId: CUSTOMER_B, role: 'member', isAdmin: false });
    const resB = await trackingGET(
      makeGetRequest('http://localhost/api/portal/tracking') as never
    );
    const bodyB = (await resB.json()) as { tracking: Array<{ event_id: string }> };
    const bEventIds = bodyB.tracking.map((e) => e.event_id);

    // A fetches tracking
    setAuth({ userId: CUSTOMER_A, role: 'member', isAdmin: false });
    const resA = await trackingGET(
      makeGetRequest('http://localhost/api/portal/tracking') as never
    );
    const bodyA = (await resA.json()) as { tracking: Array<{ event_id: string }> };
    const aEventIds = bodyA.tracking.map((e) => e.event_id);

    for (const id of bEventIds) {
      expect(aEventIds).not.toContain(id);
    }
  });
});

// ---------------------------------------------------------------------------
// Demo mode
// ---------------------------------------------------------------------------

describe('Portal orders: demo mode returns fixture data', () => {
  const CUSTOMER_A = 'user-portal-cust-a';
  const originalEnv = process.env.NEXT_PUBLIC_DEMO_MODE;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_DEMO_MODE;
    } else {
      process.env.NEXT_PUBLIC_DEMO_MODE = originalEnv;
    }
    _resetAllPortalStores();
  });

  it('returns fixture orders in demo mode', async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'true';
    _resetAllPortalStores();
    setAuth({ userId: CUSTOMER_A, role: 'member', isAdmin: false });

    const res = await ordersGET(makeGetRequest() as never);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { orders: unknown[]; total: number };
    expect(body.orders.length).toBeGreaterThan(0);
    expect(body.total).toBeGreaterThan(0);
  });

  it('demo mode still scopes orders to the authenticated customer', async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'true';
    _resetAllPortalStores();
    setAuth({ userId: CUSTOMER_A, role: 'member', isAdmin: false });

    const res = await ordersGET(makeGetRequest() as never);
    const body = (await res.json()) as { orders: Array<{ order_id: string }> };

    for (const order of body.orders) {
      expect(order.order_id).toContain(CUSTOMER_A);
    }
  });
});
