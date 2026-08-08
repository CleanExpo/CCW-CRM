import { beforeEach, describe, expect, it, vi } from 'vitest';

const hasDatabaseConfig = vi.fn();
const queryRaw = vi.fn();

vi.mock('@/lib/db/database-env', () => ({
  hasDatabaseConfig: () => hasDatabaseConfig(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => queryRaw(...args),
  },
}));

import { GET } from '../route';

beforeEach(() => {
  hasDatabaseConfig.mockReset();
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
