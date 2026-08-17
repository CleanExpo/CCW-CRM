import { Client } from 'pg';

import { getDatabaseConnectionString, getPgSslConfig } from '@/lib/db/database-env';

/** Session-level pair for the Cin7 scheduled sequential walk (stable across deploys). */
export const CIN7_SCHEDULED_SYNC_LOCK = { classId: 0x43435731, objId: 0x43494e37 } as const;

export type AdvisoryLockPair = { classId: number; objId: number };

/**
 * Hold a Postgres session advisory lock on a dedicated client for the duration of `fn`.
 * Session locks cannot use the Prisma pool — returning the connection would drop or leak the lock.
 */
export async function withPgAdvisoryLock<T>(
  pair: AdvisoryLockPair,
  fn: () => Promise<T>
): Promise<{ acquired: false; result?: undefined } | { acquired: true; result: T }> {
  const connectionString = getDatabaseConnectionString();
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }

  const client = new Client({
    connectionString,
    ssl: getPgSslConfig(),
  });
  await client.connect();
  try {
    const locked = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock($1::integer, $2::integer) AS locked',
      [pair.classId, pair.objId]
    );
    if (locked.rows[0]?.locked !== true) {
      return { acquired: false };
    }
    try {
      const result = await fn();
      return { acquired: true, result };
    } finally {
      await client.query('SELECT pg_advisory_unlock($1::integer, $2::integer)', [
        pair.classId,
        pair.objId,
      ]);
    }
  } finally {
    await client.end().catch(() => undefined);
  }
}
