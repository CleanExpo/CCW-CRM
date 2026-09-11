import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Unlike route.test.ts, this file does NOT mock database-env: a real
 * DATABASE_URL goes through the route into the classifier, so a regression in
 * either half (or in the wiring between them) is caught here.
 */
const queryRaw = vi.fn();
vi.mock('@/lib/db/prisma', () => ({
  prisma: { $queryRaw: (...args: unknown[]) => queryRaw(...args) },
}));

import { GET } from '../route';

const DIRECT = 'postgresql://postgres:hunter2@db.abcdefghijklmnop.supabase.co:5432/postgres';
const POOLER =
  'postgresql://postgres.abcdefghijklmnop:hunter2@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true';

let saved: string | undefined;
beforeEach(() => {
  saved = process.env.DATABASE_URL;
  queryRaw.mockReset();
});
afterEach(() => {
  if (saved === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = saved;
});

describe('GET /api/health host_class from a real DATABASE_URL', () => {
  it('classifies a direct host and hints at the pooler, without echoing the URL', async () => {
    process.env.DATABASE_URL = DIRECT;
    queryRaw.mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }));

    const body = await (await GET()).json();
    const text = JSON.stringify(body);

    expect(body.database).toMatchObject({ reachable: false, host_class: 'supabase-direct', error: 'ETIMEDOUT' });
    expect(body.database.hint).toContain('pooler');
    expect(text).not.toContain('hunter2');
    expect(text).not.toContain('abcdefghijklmnop');
  });

  it('classifies the pooler and stays silent when it answers', async () => {
    process.env.DATABASE_URL = POOLER;
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const body = await (await GET()).json();

    expect(body.status).toBe('healthy');
    expect(body.database).toMatchObject({ reachable: true, host_class: 'supabase-pooler' });
    expect(body.database.hint).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });

  it('reports none when nothing is configured', async () => {
    delete process.env.DATABASE_URL;
    const body = await (await GET()).json();
    expect(body.database).toMatchObject({ configured: false, host_class: 'none' });
  });
});
