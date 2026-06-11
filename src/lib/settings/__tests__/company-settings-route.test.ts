/**
 * UNI-2111: Company settings route handler tests.
 *
 * Tests:
 *   1. GET returns saved values after PUT (save persists, reload returns saved values).
 *   2. Unauthenticated requests → 401 for both GET and PUT.
 *   3. Authenticated user with no workspace → 403.
 *   4. Cross-workspace isolation: workspace B cannot read workspace A's settings.
 *   5. Missing/invalid name in PUT → 400.
 *
 * DB isolation: hasDatabaseConfig is mocked to return false so all store
 * operations use the in-memory fallback — no DATABASE_URL required in tests.
 * This is the same pattern used by bulk-reconcile-route.test.ts for Prisma routes.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { _resetAllCompanySettings, getCompanySettings } from '../company-store';

// Force in-memory path — no real DB needed in unit tests.
// Must mock BOTH database-env (so hasDatabaseConfig returns false) AND
// @/lib/db/prisma (so the PrismaClient import does not fail when
// prisma generate has not run, e.g. in CI without DATABASE_URL).
vi.mock('@/lib/db/database-env', () => ({
  hasDatabaseConfig: vi.fn().mockReturnValue(false),
  getDatabaseConnectionString: vi.fn().mockReturnValue(''),
  getPgSslConfig: vi.fn().mockReturnValue(false),
  applyPostgresSslParams: vi.fn((s: string) => s),
  MANAGED_POSTGRES_SSL_QUERY: '',
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    workspaceSettings: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

// Mock auth modules before importing route handlers
vi.mock('@/lib/auth/data-scope', () => ({
  requireAuthScope: vi.fn(),
}));

vi.mock('@/lib/auth/workspace-scope', () => ({
  getWorkspaceIdForUser: vi.fn(),
}));

import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import { GET, PUT } from '@/app/api/settings/company/route';

type MockAuthScope = { userId: string; role: 'owner' | 'admin' | 'member' | 'billing'; isAdmin: boolean } | null;

function setAuth(scope: MockAuthScope, workspaceId: string | null = 'ws-default') {
  vi.mocked(requireAuthScope).mockResolvedValue(scope);
  vi.mocked(getWorkspaceIdForUser).mockResolvedValue(scope ? workspaceId : null);
}

function makeGetRequest(): Request {
  return new Request('http://localhost/api/settings/company', { method: 'GET' });
}

function makePutRequest(body: unknown): Request {
  return new Request('http://localhost/api/settings/company', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Unauthenticated → 401
// ---------------------------------------------------------------------------

describe('company settings route: unauthenticated requests → 401', () => {
  beforeEach(() => {
    _resetAllCompanySettings();
    setAuth(null);
  });

  it('GET /api/settings/company → 401', async () => {
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(401);
    const body = await res.json() as { detail: string };
    expect(body.detail).toMatch(/not authenticated/i);
  });

  it('PUT /api/settings/company → 401', async () => {
    const res = await PUT(makePutRequest({ name: 'New Name' }) as never);
    expect(res.status).toBe(401);
    const body = await res.json() as { detail: string };
    expect(body.detail).toMatch(/not authenticated/i);
  });
});

// ---------------------------------------------------------------------------
// Authenticated but no workspace → 403
// ---------------------------------------------------------------------------

describe('company settings route: authenticated but no workspace → 403', () => {
  beforeEach(() => {
    _resetAllCompanySettings();
    setAuth({ userId: 'orphan-user', role: 'owner', isAdmin: false }, null);
  });

  it('GET /api/settings/company → 403', async () => {
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(403);
    const body = await res.json() as { detail: string };
    expect(body.detail).toMatch(/no workspace/i);
  });

  it('PUT /api/settings/company → 403', async () => {
    const res = await PUT(makePutRequest({ name: 'New Name' }) as never);
    expect(res.status).toBe(403);
    const body = await res.json() as { detail: string };
    expect(body.detail).toMatch(/no workspace/i);
  });
});

// ---------------------------------------------------------------------------
// Save persists + reload returns saved values
// ---------------------------------------------------------------------------

describe('company settings route: save persists and reload returns saved values', () => {
  const WORKSPACE = 'ws-acme-corp';

  beforeEach(() => {
    _resetAllCompanySettings();
    setAuth({ userId: 'user-acme', role: 'owner', isAdmin: false }, WORKSPACE);
  });

  it('GET returns the default seeded company name', async () => {
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(200);
    const body = await res.json() as { name: string };
    expect(typeof body.name).toBe('string');
    expect(body.name.length).toBeGreaterThan(0);
  });

  it('PUT saves name and GET returns the updated value', async () => {
    const putRes = await PUT(makePutRequest({ name: 'Acme Corp Pty Ltd' }) as never);
    expect(putRes.status).toBe(200);
    const putBody = await putRes.json() as { name: string; slug: string };
    expect(putBody.name).toBe('Acme Corp Pty Ltd');
    expect(putBody.slug).toBe('acme-corp-pty-ltd');

    // GET now returns the saved value
    const getRes = await GET(makeGetRequest() as never);
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json() as { name: string };
    expect(getBody.name).toBe('Acme Corp Pty Ltd');
  });

  it('PUT saves trading_name, abn, acn and GET returns them', async () => {
    const putRes = await PUT(
      makePutRequest({
        name: 'Acme Corp Pty Ltd',
        trading_name: 'Acme Corp',
        abn: '51 824 753 556',
        acn: '123 456 789',
      }) as never
    );
    expect(putRes.status).toBe(200);
    const putBody = await putRes.json() as {
      name: string;
      trading_name: string | null;
      abn: string | null;
      acn: string | null;
    };
    expect(putBody.trading_name).toBe('Acme Corp');
    expect(putBody.abn).toBe('51 824 753 556');
    expect(putBody.acn).toBe('123 456 789');

    // GET returns the same values
    const getRes = await GET(makeGetRequest() as never);
    const getBody = await getRes.json() as {
      trading_name: string | null;
      abn: string | null;
      acn: string | null;
    };
    expect(getBody.trading_name).toBe('Acme Corp');
    expect(getBody.abn).toBe('51 824 753 556');
    expect(getBody.acn).toBe('123 456 789');
  });

  it('PUT with missing name → 400', async () => {
    const res = await PUT(makePutRequest({ name: '' }) as never);
    expect(res.status).toBe(400);
    const body = await res.json() as { detail: string };
    expect(body.detail).toMatch(/name is required/i);
  });

  it('PUT with no name field → 400', async () => {
    const res = await PUT(makePutRequest({ trading_name: 'No Name' }) as never);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Cross-workspace isolation (spoofed / foreign org rejected)
// ---------------------------------------------------------------------------

describe('company settings route: cross-workspace isolation', () => {
  const WORKSPACE_A = 'ws-org-a';
  const WORKSPACE_B = 'ws-org-b';

  beforeEach(() => {
    _resetAllCompanySettings();
  });

  it('workspace B cannot read workspace A settings via GET', async () => {
    // Seed workspace A with a distinctive name
    setAuth({ userId: 'user-a', role: 'owner', isAdmin: false }, WORKSPACE_A);
    await PUT(makePutRequest({ name: 'Org A Secret Name' }) as never);

    // Workspace B authenticates and reads — must NOT see Org A's name
    setAuth({ userId: 'user-b', role: 'owner', isAdmin: false }, WORKSPACE_B);
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(200);
    const body = await res.json() as { name: string };
    expect(body.name).not.toBe('Org A Secret Name');
  });

  it('workspace B PUT does not overwrite workspace A settings', async () => {
    // Workspace A writes its name
    setAuth({ userId: 'user-a', role: 'owner', isAdmin: false }, WORKSPACE_A);
    await PUT(makePutRequest({ name: 'Org A Original' }) as never);

    // Workspace B writes its own name
    setAuth({ userId: 'user-b', role: 'owner', isAdmin: false }, WORKSPACE_B);
    await PUT(makePutRequest({ name: 'Org B Name' }) as never);

    // Workspace A reads — still sees its original value
    setAuth({ userId: 'user-a', role: 'owner', isAdmin: false }, WORKSPACE_A);
    const res = await GET(makeGetRequest() as never);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('Org A Original');
  });

  it('workspaceId cannot be spoofed via request body', async () => {
    // Workspace A saves a value
    setAuth({ userId: 'user-a', role: 'owner', isAdmin: false }, WORKSPACE_A);
    await PUT(makePutRequest({ name: 'Real Org A Name' }) as never);

    // Workspace B attempts to inject workspace A's id into the body — must be ignored.
    // The route uses getWorkspaceIdForUser(scope.userId) from DB, not body values.
    setAuth({ userId: 'user-b', role: 'owner', isAdmin: false }, WORKSPACE_B);
    const attackBody = { name: 'Attacker', workspaceId: WORKSPACE_A, id: WORKSPACE_A };
    await PUT(makePutRequest(attackBody) as never);

    // Workspace A still has original value in the store
    const storeA = await getCompanySettings(WORKSPACE_A);
    expect(storeA.name).toBe('Real Org A Name');
  });
});
