// @vitest-environment node

/**
 * The scheduled Cin7 walk mints an access token for the owner and posts the
 * sync route with it. getAuthClaimsFromRequest rejects a token whose session
 * version differs from the user's, so the minted token must carry the user's
 * current sessionVersion or every chunk comes back 401 once the owner has
 * ever changed password / signed out everywhere.
 */
import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const findAppUserById = vi.fn();
vi.mock('@/lib/auth/app-user-repo', () => ({
  findAppUserById: (...args: unknown[]) => findAppUserById(...args),
}));

// Stand-in for the sync route: authenticate the request exactly as the real
// route's auth path does, and record whether the token was accepted.
const acceptedClaims: unknown[] = [];
vi.mock('@/app/api/integrations/cin7/sync/[entityType]/route', async () => {
  const { getAuthClaimsFromRequest } = await import('@/lib/auth/request-token');
  const { NextResponse } = await import('next/server');
  return {
    POST: async (request: NextRequest) => {
      const claims = await getAuthClaimsFromRequest(request);
      acceptedClaims.push(claims);
      return claims
        ? NextResponse.json({ status: 'completed', records: 0 })
        : NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    },
  };
});

vi.mock('@/lib/integrations/cin7-sequential-sync', () => ({
  defaultScheduledSyncSleep: async () => {},
  runCin7SequentialEntityWalk: async (opts: {
    postChunk: (entity: string, o: { restart: boolean; full: boolean }) => Promise<unknown>;
  }) => {
    let ok = true;
    try {
      await opts.postChunk('products', { restart: false, full: false });
    } catch {
      ok = false;
    }
    return { cin7AllComplete: ok, entityResults: {} };
  },
}));

vi.mock('@/lib/db/advisory-lock', () => ({
  CIN7_SCHEDULED_SYNC_LOCK: 1,
  withPgAdvisoryLock: async (_lock: unknown, fn: () => Promise<unknown>) => ({
    acquired: true,
    result: await fn(),
  }),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    cin7NightlySyncLedger: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      create: vi.fn(async () => ({ id: 'ledger-1' })),
      update: vi.fn(async () => ({})),
    },
    cin7SyncRun: { findFirst: vi.fn(async () => null) },
    appUser: { findFirst: vi.fn(async () => null) },
  },
}));

vi.mock('@/lib/integrations/cin7-server-scheduler', () => ({
  getCin7SchedulerSnapshot: () => ({ running: false, actorUserId: null, nextFireAt: null }),
  setCin7ScheduledSyncRunning: () => {},
}));
vi.mock('@/lib/integrations/cin7-scheduled-sync', () => ({
  getCin7ProductionSlotAtOrBefore: () => new Date(0),
  isCin7NightlyLedgerLive: () => false,
}));
vi.mock('@/lib/integrations/cin7-recon-snapshot-store', () => ({
  persistImmutableReconSnapshot: vi.fn(async () => {}),
}));
vi.mock('@/lib/integrations/cin7-reconciliation', () => ({
  buildCin7Reconciliation: vi.fn(),
}));
vi.mock('@/lib/integrations/cin7-reconciliation-cache', () => ({
  getOrBuildReconciliation: vi.fn(async () => ({ snapshot: {} })),
}));

import { runCin7ScheduledSyncJob } from '@/lib/integrations/cin7-server-scheduled-sync';

const prevSecret = process.env.JWT_SECRET;

function owner(sessionVersion: number) {
  return {
    id: 'owner-1',
    email: 'owner@example.test',
    isAdmin: true,
    isActive: true,
    role: 'owner',
    sessionVersion,
  };
}

describe('scheduled Cin7 walk: minted token vs session version', () => {
  beforeAll(() => {
    // Random per run: a throwaway signing key for this process, not a credential.
    process.env.JWT_SECRET = randomUUID();
  });
  afterAll(() => {
    if (prevSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prevSecret;
  });
  beforeEach(() => {
    acceptedClaims.length = 0;
    findAppUserById.mockReset();
  });

  it('positive control: token is accepted when the owner is on session version 0', async () => {
    findAppUserById.mockResolvedValue(owner(0));
    const result = await runCin7ScheduledSyncJob({ ownerUserId: 'owner-1' });
    expect(acceptedClaims).toHaveLength(1);
    expect(acceptedClaims[0]).not.toBeNull();
    expect(result.cin7_complete).toBe(true);
  });

  it('token is accepted when the owner has bumped their session version', async () => {
    findAppUserById.mockResolvedValue(owner(3));
    const result = await runCin7ScheduledSyncJob({ ownerUserId: 'owner-1' });
    expect(acceptedClaims).toHaveLength(1);
    expect(acceptedClaims[0]).toMatchObject({ sub: 'owner-1', session_version: 3 });
    expect(result.cin7_complete).toBe(true);
  });
});
