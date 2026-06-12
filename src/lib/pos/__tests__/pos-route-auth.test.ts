/**
 * UNI-2107: POS route handler auth-gate, workspace-sharing, and cross-workspace isolation tests.
 *
 * Tests that:
 * 1. Every POS route handler returns 401 when not authenticated.
 * 2. Users without a workspace get 403.
 * 3. Two users in the SAME workspace share POS data (UNI-2107 acceptance criterion).
 * 4. Users in DIFFERENT workspaces are isolated from each other.
 *
 * Uses vi.mock to control requireAuthScope and getWorkspaceIdForUser so no real JWT/DB is needed.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { _resetAllPosStores, getPosStore } from '../mock-store';

// Mock the auth modules before importing route handlers
vi.mock('@/lib/auth/data-scope', () => ({
  requireAuthScope: vi.fn(),
}));

vi.mock('@/lib/auth/workspace-scope', () => ({
  getWorkspaceIdForUser: vi.fn(),
}));

import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import { GET as locationsGET, POST as locationsPOST } from '@/app/api/pos/locations/route';
import { GET as staffGET, POST as staffPOST } from '@/app/api/pos/staff/route';
import { GET as terminalsGET, POST as terminalsPOST } from '@/app/api/pos/terminals/route';
import { GET as salesStaffGET } from '@/app/api/pos/sales-staff/route';

type MockAuthScope = { userId: string; role: 'owner' | 'admin' | 'member' | 'billing'; isAdmin: boolean } | null;

function setAuth(scope: MockAuthScope, workspaceId: string | null = 'ws-default') {
  vi.mocked(requireAuthScope).mockResolvedValue(scope);
  vi.mocked(getWorkspaceIdForUser).mockResolvedValue(scope ? workspaceId : null);
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
    setAuth(null); // no session → requireAuthScope returns null
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
// No workspace → 403
// ---------------------------------------------------------------------------

describe('POS route handlers: authenticated but no workspace → 403', () => {
  beforeEach(() => {
    _resetAllPosStores();
    setAuth({ userId: 'orphan-user', role: 'owner', isAdmin: false }, null);
  });

  it('GET /api/pos/locations → 403', async () => {
    const res = await locationsGET(makeGetRequest() as never);
    expect(res.status).toBe(403);
  });

  it('GET /api/pos/staff → 403', async () => {
    const res = await staffGET(makeGetRequest() as never);
    expect(res.status).toBe(403);
  });

  it('GET /api/pos/terminals → 403', async () => {
    const res = await terminalsGET(makeGetRequest() as never);
    expect(res.status).toBe(403);
  });

  it('GET /api/pos/sales-staff → 403', async () => {
    const res = await salesStaffGET(makeGetRequest() as never);
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Same-workspace sharing (UNI-2107 primary acceptance criterion)
// ---------------------------------------------------------------------------

describe('POS route handlers: same-workspace users SHARE the store', () => {
  const SHARED_WORKSPACE = 'ws-shared-acme';

  beforeEach(() => {
    _resetAllPosStores();
  });

  it('location created by user-1 is visible to user-2 in the same workspace', async () => {
    // User 1 (same workspace) creates a location
    setAuth({ userId: 'user-ws-member-1', role: 'owner', isAdmin: false }, SHARED_WORKSPACE);
    const postRes = await locationsPOST(
      makePostRequest({ code: 'shared-office', name: 'Shared Office' }) as never
    );
    expect(postRes.status).toBe(201);

    // User 2 (same workspace) lists — must see it
    setAuth({ userId: 'user-ws-member-2', role: 'member', isAdmin: false }, SHARED_WORKSPACE);
    const getRes = await locationsGET(makeGetRequest() as never);
    expect(getRes.status).toBe(200);
    const body = (await getRes.json()) as { data: Array<{ code: string }> };
    expect(body.data.map((l) => l.code)).toContain('shared-office');
  });

  it('staff created by user-1 is visible to user-2 in the same workspace', async () => {
    setAuth({ userId: 'user-ws-member-1', role: 'owner', isAdmin: false }, SHARED_WORKSPACE);
    const postRes = await staffPOST(
      makePostRequest({ staff_code: 'SHARED-REP', full_name: 'Shared Rep', primary_location_code: 'brisbane' }) as never
    );
    expect(postRes.status).toBe(201);

    setAuth({ userId: 'user-ws-member-2', role: 'member', isAdmin: false }, SHARED_WORKSPACE);
    const getRes = await staffGET(makeGetRequest() as never);
    expect(getRes.status).toBe(200);
    const body = (await getRes.json()) as { data: Array<{ staff_code: string }> };
    expect(body.data.map((s) => s.staff_code)).toContain('SHARED-REP');
  });

  it('terminal created by user-1 is visible to user-2 in the same workspace', async () => {
    setAuth({ userId: 'user-ws-member-1', role: 'owner', isAdmin: false }, SHARED_WORKSPACE);
    const postRes = await terminalsPOST(
      makePostRequest({ terminal_id: 'TERM-SHARED-01', location_code: 'brisbane' }) as never
    );
    expect(postRes.status).toBe(201);

    setAuth({ userId: 'user-ws-member-2', role: 'member', isAdmin: false }, SHARED_WORKSPACE);
    const getRes = await terminalsGET(makeGetRequest() as never);
    expect(getRes.status).toBe(200);
    const body = (await getRes.json()) as { data: Array<{ terminal_id: string }> };
    expect(body.data.map((t) => t.terminal_id)).toContain('TERM-SHARED-01');
  });
});

// ---------------------------------------------------------------------------
// Cross-workspace read blocking via route handlers
// ---------------------------------------------------------------------------

describe('POS route handlers: cross-workspace users are isolated', () => {
  beforeEach(() => {
    _resetAllPosStores();
  });

  it('locations GET: workspace A does not see workspace B private location', async () => {
    // Pre-seed workspace B's private location directly in the store
    const storeB = getPosStore('ws-org-b');
    storeB.locations.push({
      id: 'b-private-loc',
      code: 'b-secret',
      name: 'WS-B Secret Location',
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

    // Workspace A authenticates and calls GET
    setAuth({ userId: 'user-org-a', role: 'owner', isAdmin: false }, 'ws-org-a');
    const res = await locationsGET(makeGetRequest() as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ code: string }> };
    expect(body.data.map((l) => l.code)).not.toContain('b-secret');
  });

  it('staff GET: workspace B does not see workspace A private staff member', async () => {
    const storeA = getPosStore('ws-org-a');
    storeA.staff.push({
      id: 'a-private-staff',
      staff_code: 'A-PRIVATE',
      full_name: 'WS-A Private Staff',
      email: null,
      phone: null,
      primary_location_code: 'brisbane',
      can_sell_at_locations: ['brisbane'],
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    setAuth({ userId: 'user-org-b', role: 'owner', isAdmin: false }, 'ws-org-b');
    const res = await staffGET(makeGetRequest() as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ staff_code: string }> };
    expect(body.data.map((s) => s.staff_code)).not.toContain('A-PRIVATE');
  });

  it('terminals GET: workspace B does not see workspace A private terminal', async () => {
    const storeA = getPosStore('ws-org-a');
    storeA.terminals.push({
      id: 'a-private-term',
      terminal_id: 'TERM-A-SECRET',
      location_code: 'brisbane',
      terminal_type: 'counter',
      is_active: true,
      merchant_id: null,
      last_ping_at: null,
    });

    setAuth({ userId: 'user-org-b', role: 'owner', isAdmin: false }, 'ws-org-b');
    const res = await terminalsGET(makeGetRequest() as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ terminal_id: string }> };
    expect(body.data.map((t) => t.terminal_id)).not.toContain('TERM-A-SECRET');
  });

  it('sales-staff GET: workspace B does not see workspace A sales staff', async () => {
    const storeA = getPosStore('ws-org-a');
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

    setAuth({ userId: 'user-org-b', role: 'owner', isAdmin: false }, 'ws-org-b');
    const res = await salesStaffGET(makeGetRequest() as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ staff_code: string }>;
    expect(body.map((s) => s.staff_code)).not.toContain('A-SALES');
  });

  it('POST to locations by workspace A does not bleed into workspace B', async () => {
    // Workspace A creates a location
    setAuth({ userId: 'user-org-a', role: 'owner', isAdmin: false }, 'ws-org-a');
    const postRes = await locationsPOST(
      makePostRequest({ code: 'a-new-site', name: 'WS-A New Site' }) as never
    );
    expect(postRes.status).toBe(201);

    // Workspace B lists — must not see it
    setAuth({ userId: 'user-org-b', role: 'owner', isAdmin: false }, 'ws-org-b');
    const getRes = await locationsGET(makeGetRequest() as never);
    const body = (await getRes.json()) as { data: Array<{ code: string }> };
    expect(body.data.map((l) => l.code)).not.toContain('a-new-site');
  });
});
