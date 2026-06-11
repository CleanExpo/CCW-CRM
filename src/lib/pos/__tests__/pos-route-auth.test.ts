/**
 * UNI-2107: POS route handler auth-gate and cross-tenant cross-read tests.
 *
 * Tests that:
 * 1. Every POS route handler returns 401 when not authenticated.
 * 2. Org A cannot read Org B's data through the same handler.
 *
 * Uses vi.mock to control requireAuthScope so no real JWT/DB is needed.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { _resetAllPosStores, getPosStore } from '../mock-store';

// Mock the auth module before importing route handlers
vi.mock('@/lib/auth/data-scope', () => ({
  requireAuthScope: vi.fn(),
}));

import { requireAuthScope } from '@/lib/auth/data-scope';
import { GET as locationsGET, POST as locationsPOST } from '@/app/api/pos/locations/route';
import { GET as staffGET, POST as staffPOST } from '@/app/api/pos/staff/route';
import { GET as terminalsGET, POST as terminalsPOST } from '@/app/api/pos/terminals/route';
import { GET as salesStaffGET } from '@/app/api/pos/sales-staff/route';

type MockAuthScope = { userId: string; role: 'owner' | 'admin' | 'member' | 'billing'; isAdmin: boolean } | null;

function setAuth(scope: MockAuthScope) {
  vi.mocked(requireAuthScope).mockResolvedValue(scope);
}

function makeGetRequest(): Request {
  return new Request('http://localhost/api/pos/test', { method: 'GET' });
}

function makePostRequest(body: unknown): Request {
  return new Request('http://localhost/api/pos/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Auth gate: unauthenticated → 401
// ---------------------------------------------------------------------------

describe('POS route handlers: unauthenticated requests are blocked (401)', () => {
  beforeEach(() => {
    _resetAllPosStores();
    setAuth(null); // no session
  });

  it('GET /api/pos/locations → 401', async () => {
    const res = await locationsGET(makeGetRequest() as never);
    expect(res.status).toBe(401);
  });

  it('POST /api/pos/locations → 401', async () => {
    const res = await locationsPOST(makePostRequest({ code: 'test', name: 'Test' }) as never);
    expect(res.status).toBe(401);
  });

  it('GET /api/pos/staff → 401', async () => {
    const res = await staffGET(makeGetRequest() as never);
    expect(res.status).toBe(401);
  });

  it('POST /api/pos/staff → 401', async () => {
    const res = await staffPOST(
      makePostRequest({ staff_code: 'X', full_name: 'X', primary_location_code: 'brisbane' }) as never
    );
    expect(res.status).toBe(401);
  });

  it('GET /api/pos/terminals → 401', async () => {
    const res = await terminalsGET(makeGetRequest() as never);
    expect(res.status).toBe(401);
  });

  it('POST /api/pos/terminals → 401', async () => {
    const res = await terminalsPOST(
      makePostRequest({ terminal_id: 'T1', location_code: 'brisbane' }) as never
    );
    expect(res.status).toBe(401);
  });

  it('GET /api/pos/sales-staff → 401', async () => {
    const res = await salesStaffGET(makeGetRequest() as never);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Cross-tenant read blocking via route handlers
// ---------------------------------------------------------------------------

describe('POS route handlers: org A cannot read org B data', () => {
  beforeEach(() => {
    _resetAllPosStores();
  });

  it('locations GET: org A does not see org B private location', async () => {
    // Pre-seed org B's private location directly in the store
    const storeB = getPosStore('user-org-b');
    storeB.locations.push({
      id: 'b-private-loc',
      code: 'b-secret',
      name: 'Org B Secret Location',
      location_type: 'physical',
      address: null,
      city: null,
      state: null,
      postal_code: null,
      country: 'Australia',
      timezone: 'Australia/Brisbane',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Org A authenticates and calls GET
    setAuth({ userId: 'user-org-a', role: 'owner', isAdmin: false });
    const res = await locationsGET(makeGetRequest() as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ code: string }> };
    expect(body.data.map((l) => l.code)).not.toContain('b-secret');
  });

  it('staff GET: org B does not see org A private staff member', async () => {
    const storeA = getPosStore('user-org-a');
    storeA.staff.push({
      id: 'a-private-staff',
      staff_code: 'A-PRIVATE',
      full_name: 'Org A Private Staff',
      email: null,
      phone: null,
      primary_location_code: 'brisbane',
      can_sell_at_locations: ['brisbane'],
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    setAuth({ userId: 'user-org-b', role: 'owner', isAdmin: false });
    const res = await staffGET(makeGetRequest() as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ staff_code: string }> };
    expect(body.data.map((s) => s.staff_code)).not.toContain('A-PRIVATE');
  });

  it('terminals GET: org B does not see org A private terminal', async () => {
    const storeA = getPosStore('user-org-a');
    storeA.terminals.push({
      id: 'a-private-term',
      terminal_id: 'TERM-A-SECRET',
      location_code: 'brisbane',
      terminal_type: 'counter',
      is_active: true,
      merchant_id: null,
      last_ping_at: null,
    });

    setAuth({ userId: 'user-org-b', role: 'owner', isAdmin: false });
    const res = await terminalsGET(makeGetRequest() as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ terminal_id: string }> };
    expect(body.data.map((t) => t.terminal_id)).not.toContain('TERM-A-SECRET');
  });

  it('sales-staff GET: org B does not see org A sales staff', async () => {
    const storeA = getPosStore('user-org-a');
    storeA.staff.push({
      id: 'a-sales-staff',
      staff_code: 'A-SALES',
      full_name: 'A Sales Rep',
      email: null,
      phone: null,
      primary_location_code: 'brisbane',
      can_sell_at_locations: ['brisbane'],
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    setAuth({ userId: 'user-org-b', role: 'owner', isAdmin: false });
    const res = await salesStaffGET(makeGetRequest() as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ staff_code: string }>;
    expect(body.map((s) => s.staff_code)).not.toContain('A-SALES');
  });

  it('POST to locations by org A does not bleed into org B', async () => {
    // Org A creates a location
    setAuth({ userId: 'user-org-a', role: 'owner', isAdmin: false });
    const postRes = await locationsPOST(
      makePostRequest({ code: 'a-new-site', name: 'Org A New Site' }) as never
    );
    expect(postRes.status).toBe(201);

    // Org B lists — must not see it
    setAuth({ userId: 'user-org-b', role: 'owner', isAdmin: false });
    const getRes = await locationsGET(makeGetRequest() as never);
    const body = (await getRes.json()) as { data: Array<{ code: string }> };
    expect(body.data.map((l) => l.code)).not.toContain('a-new-site');
  });
});
