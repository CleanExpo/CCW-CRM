import { beforeEach, describe, expect, it, vi } from 'vitest';

const hasDatabaseConfig = vi.fn();
const classifyDatabaseHost = vi.fn();
const queryRaw = vi.fn();

vi.mock('@/lib/db/database-env', () => ({
  hasDatabaseConfig: () => hasDatabaseConfig(),
  classifyDatabaseHost: () => classifyDatabaseHost(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => queryRaw(...args),
  },
}));

import { GET } from '../route';

beforeEach(() => {
  hasDatabaseConfig.mockReset();
  classifyDatabaseHost.mockReset();
  classifyDatabaseHost.mockReturnValue('other');
  queryRaw.mockReset();
});

describe('GET /api/health', () => {
  it('is healthy only when the database actually answers', async () => {
    hasDatabaseConfig.mockReturnValue(true);
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.database).toMatchObject({ configured: true, reachable: true });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('is unhealthy when the database is configured but unreachable', async () => {
    // The exact production case on 2026-08-08: DATABASE_URL present but
    // malformed, so Prisma throws P1001. The previous implementation reported
    // "healthy" here because it only checked that config existed.
    hasDatabaseConfig.mockReturnValue(true);
    queryRaw.mockRejectedValue(
      Object.assign(new Error("Can't reach database server at base"), { code: 'P1001' })
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('unhealthy');
    expect(body.database).toMatchObject({ configured: true, reachable: false, error: 'P1001' });
  });

  it('is unhealthy when the database is not configured at all', async () => {
    hasDatabaseConfig.mockReturnValue(false);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('unhealthy');
    expect(body.database).toMatchObject({ configured: false, reachable: false });
    // No point dialling a database we have no address for.
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('never leaks the connection string or error message in the payload', async () => {
    hasDatabaseConfig.mockReturnValue(true);
    queryRaw.mockRejectedValue(
      Object.assign(
        new Error('failed: postgresql://postgres:hunter2@db.example.supabase.co:6543/postgres'),
        { code: 'P1001' }
      )
    );

    const response = await GET();
    const serialised = JSON.stringify(await response.json());

    expect(serialised).not.toContain('hunter2');
    expect(serialised).not.toContain('postgresql://');
    expect(serialised).toContain('P1001');
  });

  // The P0 found in review: `error.code` was echoed verbatim whenever it was a
  // non-empty string, so DSN material placed in `code` (not just the message)
  // reached this public, unauthenticated endpoint. Only known-safe shapes are
  // echoed now; anything else is dropped.
  const DSN = 'postgresql://postgres:hunter2@db.example.supabase.co:6543/postgres';

  it('drops a connection string planted in error.code', async () => {
    hasDatabaseConfig.mockReturnValue(true);
    queryRaw.mockRejectedValue(Object.assign(new Error('boom'), { code: DSN }));

    const response = await GET();
    const serialised = JSON.stringify(await response.json());

    expect(serialised).not.toContain('hunter2');
    expect(serialised).not.toContain('postgresql://');
    expect(serialised).not.toContain('supabase.co');
  });

  it('drops a connection string planted in error.name', async () => {
    hasDatabaseConfig.mockReturnValue(true);
    const failure = new Error('boom');
    failure.name = DSN;
    queryRaw.mockRejectedValue(failure);

    const response = await GET();
    const body = await response.json();

    expect(body.database.error).toBe('UnknownError');
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });

  it('falls back when both code and name are hostile', async () => {
    hasDatabaseConfig.mockReturnValue(true);
    const failure = new Error(DSN);
    failure.name = DSN;
    queryRaw.mockRejectedValue(Object.assign(failure, { code: DSN }));

    const response = await GET();
    const body = await response.json();

    expect(body.database.error).toBe('UnknownError');
    expect(JSON.stringify(body)).not.toContain('postgresql://');
  });

  // The P1 found in the second review: shape-matching is not recognition. A
  // value that merely LOOKS like a code — 'TOKEN' fits the SQLSTATE shape,
  // 'LettersOnlySecret' fits the name shape — was still echoed publicly.
  it.each([
    ['code', { code: 'TOKEN' }],
    ['code', { code: 'ABCDE' }],
    ['name', { name: 'LettersOnlySecret' }],
  ])('drops safe-shaped but unrecognised secrets in error.%s', async (_field, props) => {
    hasDatabaseConfig.mockReturnValue(true);
    const failure = new Error('boom');
    if ('name' in props && props.name) failure.name = props.name;
    queryRaw.mockRejectedValue(Object.assign(failure, props));

    const response = await GET();
    const body = await response.json();

    expect(body.database.error).toBe('UnknownError');
  });

  it('still echoes genuinely diagnostic codes', async () => {
    hasDatabaseConfig.mockReturnValue(true);
    queryRaw.mockRejectedValue(Object.assign(new Error('boom'), { code: 'ECONNREFUSED' }));

    const response = await GET();
    const body = await response.json();

    expect(body.database.error).toBe('ECONNREFUSED');
  });

  // Production on 2026-09-03: DATABASE_URL set, every probe a ProbeTimeout.
  // The host class is the one non-secret fact that explains it.
  it('publishes the host class and a hint when a Supabase direct host times out', async () => {
    hasDatabaseConfig.mockReturnValue(true);
    classifyDatabaseHost.mockReturnValue('supabase-direct');
    queryRaw.mockImplementation(() => new Promise(() => undefined));
    vi.useFakeTimers();
    try {
      const pending = GET();
      await vi.advanceTimersByTimeAsync(5_000);
      const response = await pending;
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.database).toMatchObject({
        reachable: false,
        error: 'ProbeTimeout',
        host_class: 'supabase-direct',
      });
      expect(body.database.hint).toContain('pooler');
      // The hint is a template, never the configured value.
      expect(JSON.stringify(body)).not.toContain('postgresql://');
    } finally {
      vi.useRealTimers();
    }
  });

  it('publishes the host class without a hint when a pooler host is reachable', async () => {
    hasDatabaseConfig.mockReturnValue(true);
    classifyDatabaseHost.mockReturnValue('supabase-pooler');
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const body = await (await GET()).json();

    expect(body.database).toMatchObject({ reachable: true, host_class: 'supabase-pooler' });
    expect(body.database.hint).toBeUndefined();
  });

  it('reports the failure class when the error carries no code', async () => {
    hasDatabaseConfig.mockReturnValue(true);
    const failure = new Error('socket hang up');
    failure.name = 'DriverAdapterError';
    queryRaw.mockRejectedValue(failure);

    const response = await GET();
    const body = await response.json();

    expect(body.database.error).toBe('DriverAdapterError');
  });
});
