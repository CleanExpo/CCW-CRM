import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyPostgresSslParams,
  classifyDatabaseHost,
  getDatabaseConnectionString,
  getPgSslConfig,
  hasDatabaseConfig,
  MANAGED_POSTGRES_SSL_QUERY,
} from '../database-env';

const DB_KEYS = [
  'DATABASE_URL',
  'DB_USER',
  'DB_PASSWORD',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_DATABASE',
  'DB_SSL',
  'DB_CA_CERT',
  'DB_SSL_REJECT_UNAUTHORIZED',
];

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const key of DB_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of DB_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('applyPostgresSslParams', () => {
  it('requires libpq-compatible TLS for a remote host', () => {
    const result = applyPostgresSslParams('postgresql://u:p@db.example.com:25060/defaultdb');
    expect(result).toContain('uselibpqcompat=true');
    expect(result).toContain('sslmode=require');
  });

  it('disables TLS for localhost and drops the libpq flag', () => {
    const result = applyPostgresSslParams(
      `postgresql://u:p@localhost:5432/app?${MANAGED_POSTGRES_SSL_QUERY}`
    );
    expect(result).toContain('sslmode=disable');
    expect(result).not.toContain('uselibpqcompat');
  });

  it('treats 127.0.0.1 the same as localhost', () => {
    expect(applyPostgresSslParams('postgresql://u:p@127.0.0.1:5432/app')).toContain(
      'sslmode=disable'
    );
  });

  it.each(['false', '0', 'disable', 'DISABLE'])(
    'honours DB_SSL=%s by disabling TLS even for a remote host',
    (value) => {
      process.env.DB_SSL = value;
      expect(applyPostgresSslParams('postgresql://u:p@db.example.com:25060/x')).toContain(
        'sslmode=disable'
      );
    }
  );

  it('percent-encodes credentials that make the raw URL unparseable', () => {
    // A space in the password makes `new URL()` throw; the fallback re-encodes it.
    const result = applyPostgresSslParams('postgresql://us er:pa ss@db.example.com:25060/x');
    expect(result).toContain('us%20er');
    expect(result).toContain('pa%20ss');
    expect(result).toContain('sslmode=require');
  });

  it('returns the input unchanged when it cannot be parsed as a URL at all', () => {
    expect(applyPostgresSslParams('not-a-connection-string')).toBe('not-a-connection-string');
  });
});

describe('getDatabaseConnectionString', () => {
  it('prefers DATABASE_URL and normalizes its TLS params', () => {
    process.env.DATABASE_URL = 'postgresql://u:p@db.example.com:25060/defaultdb';
    expect(getDatabaseConnectionString()).toContain('sslmode=require');
  });

  it('assembles a URL from DB_* parts, defaulting port and database', () => {
    process.env.DB_USER = 'admin';
    process.env.DB_PASSWORD = 'secret';
    process.env.DB_HOST = 'db.example.com';

    const result = getDatabaseConnectionString();
    expect(result).toContain('admin:secret@db.example.com:5432/defaultdb');
    expect(result).toContain('sslmode=require');
  });

  it('encodes credentials containing URL-significant characters', () => {
    process.env.DB_USER = 'a@dmin';
    process.env.DB_PASSWORD = 'p@ss/word';
    process.env.DB_HOST = 'db.example.com';

    const result = getDatabaseConnectionString();
    expect(result).toContain('a%40dmin');
    expect(result).toContain('p%40ss%2Fword');
  });

  it('returns empty string when the DB_* set is incomplete', () => {
    process.env.DB_USER = 'admin';
    process.env.DB_HOST = 'db.example.com';
    // DB_PASSWORD deliberately absent
    expect(getDatabaseConnectionString()).toBe('');
  });
});

describe('classifyDatabaseHost', () => {
  it('is none without configuration', () => {
    expect(classifyDatabaseHost()).toBe('none');
  });

  it('recognises a Supabase direct host, which Vercel cannot route to', () => {
    process.env.DATABASE_URL = 'postgresql://postgres:pw@db.abcdefghijklmnop.supabase.co:5432/postgres';
    expect(classifyDatabaseHost()).toBe('supabase-direct');
  });

  it('recognises the Supabase transaction pooler', () => {
    process.env.DATABASE_URL =
      'postgresql://postgres.abcdefghijklmnop:pw@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true';
    expect(classifyDatabaseHost()).toBe('supabase-pooler');
  });

  it('classifies localhost and everything else without echoing the host', () => {
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/app';
    expect(classifyDatabaseHost()).toBe('local');
    process.env.DB_USER = 'u';
    process.env.DB_PASSWORD = 'p';
    process.env.DB_HOST = 'db.example.com';
    delete process.env.DATABASE_URL;
    expect(classifyDatabaseHost()).toBe('other');
  });
});

describe('hasDatabaseConfig', () => {
  it('is false with no configuration at all', () => {
    expect(hasDatabaseConfig()).toBe(false);
  });

  it('is true from DATABASE_URL alone', () => {
    process.env.DATABASE_URL = 'postgresql://u:p@db.example.com:25060/x';
    expect(hasDatabaseConfig()).toBe(true);
  });

  it('is false when the DB_* trio is incomplete', () => {
    process.env.DB_USER = 'admin';
    process.env.DB_PASSWORD = 'secret';
    // DB_HOST deliberately absent
    expect(hasDatabaseConfig()).toBe(false);
  });
});

describe('getPgSslConfig', () => {
  it('is false when there is no connection string', () => {
    expect(getPgSslConfig()).toBe(false);
  });

  it('is false for localhost', () => {
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/app';
    expect(getPgSslConfig()).toBe(false);
  });

  it('relaxes verification for managed remote Postgres', () => {
    process.env.DATABASE_URL = 'postgresql://u:p@db.example.com:25060/defaultdb';
    expect(getPgSslConfig()).toEqual({ rejectUnauthorized: false });
  });

  it('falls back to relaxed TLS when DB_CA_CERT cannot be read', () => {
    process.env.DATABASE_URL = 'postgresql://u:p@db.example.com:25060/defaultdb';
    process.env.DB_CA_CERT = '/nonexistent/path/to/ca.pem';
    process.env.DB_SSL_REJECT_UNAUTHORIZED = 'true';
    expect(getPgSslConfig()).toEqual({ rejectUnauthorized: false });
  });
});
