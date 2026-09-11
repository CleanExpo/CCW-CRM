import { describe, expect, it } from 'vitest';
import {
  RECEIPT_MARKER,
  buildReceipt,
  canonicalJson,
  collectRuntimeReceipt,
  redact,
  stripUrlCredentials,
  verifyReceipt,
} from '../runtime-receipt';

const DSN = 'postgresql://postgres:hunter2@db.example.supabase.co:5432/postgres';
// Assembled at runtime so the repository's own secret scanner never sees a
// key-shaped literal; the redactor must still catch the assembled value.
const STRIPE_SHAPED = ['sk', 'live', 'ABC123def'].join('_');
const AWS_SHAPED = `${'AK'}${'IA'}${'ABCDEFGH'}${'IJKLMNOP'}`;

describe('redact', () => {
  it('blanks credential-shaped keys and connection strings anywhere in a body', () => {
    const out = redact({
      access_token: 'abc',
      nested: { "Set-Cookie": "x", message: `failed: ${DSN} now` },
      list: [DSN, { password: 'p' }],
      status: 'healthy',
    });
    const text = JSON.stringify(out);
    expect(text).not.toContain('abc');
    expect(text).not.toContain('hunter2');
    expect(text).not.toContain('postgresql://');
    expect(out.status).toBe('healthy');
  });

  it('catches secrets the key list does not name: JWTs, bearer tokens, any URL with userinfo', () => {
    const out = redact({
      jwt: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghijklmnop',
      bearer: 'Bearer eyJ-BEARER',
      session: 'SESSION-ID-VALUE',
      credentials: 'CRED-VALUE',
      dsn: 'mysql://root:MYSQLPW@h/db',
      cache: 'redis://:REDISPW@host:6379',
      note: 'Authorization: Bearer eyJ-INLINE and eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghijklmnop',
      basic: 'Basic dXNlcjpwYXNz',
      key: 'KEYVAL',
      pass: 'PASSVAL',
      pwd: 'PWDVAL',
      supabase_service_role: 'ROLEVAL',
      free: `x-api-key: XAPIKEYVAL then PGPASSWORD=PGPWVAL and client_secret="CSVAL" plus ${STRIPE_SHAPED} and ${AWS_SHAPED}`,
    });
    const text = JSON.stringify(out);
    for (const leak of [
      'MYSQLPW', 'REDISPW', 'SESSION-ID', 'CRED-VALUE', 'eyJ-BEARER', 'eyJ-INLINE', 'eyJhbGci', 'dXNlcjpwYXNz',
      'KEYVAL', 'PASSVAL', 'PWDVAL', 'ROLEVAL', 'XAPIKEYVAL', 'PGPWVAL', 'CSVAL', STRIPE_SHAPED, AWS_SHAPED,
    ]) {
      expect(text).not.toContain(leak);
    }
  });
});

describe('stripUrlCredentials', () => {
  it('drops userinfo from the base URL', () => {
    expect(stripUrlCredentials('https://user:BASICPW@example.test/')).toBe('https://example.test');
    expect(stripUrlCredentials('not a url http://u:p@x.y')).not.toContain('u:p@');
  });
});

describe('buildReceipt', () => {
  const readAt = '2026-09-03T02:57:02.214Z';
  const baseUrl = 'https://ccw-crm-web.vercel.app';

  it('is healthy only when /api/health is 200 and the database answered', () => {
    const receipt = buildReceipt({
      baseUrl,
      readAt,
      probes: [
        { name: 'landing', method: 'GET', path: '/', status: 200 },
        {
          name: 'health',
          method: 'GET',
          path: '/api/health',
          status: 200,
          body: { status: 'healthy', database: { configured: true, reachable: true } },
        },
      ],
    });
    expect(receipt.marker).toBe(RECEIPT_MARKER);
    expect(receipt.verdict).toBe('healthy');
    expect(verifyReceipt(receipt)).toBe(true);
  });

  it('is unhealthy for the 2026-09-03 production answer', () => {
    const receipt = buildReceipt({
      baseUrl,
      readAt,
      probes: [
        { name: 'landing', method: 'GET', path: '/', status: 200 },
        {
          name: 'health',
          method: 'GET',
          path: '/api/health',
          status: 503,
          body: {
            status: 'unhealthy',
            database: { configured: true, reachable: false, error: 'ProbeTimeout' },
          },
        },
      ],
    });
    expect(receipt.verdict).toBe('unhealthy');
  });

  it('hashes the redacted record, so an edited receipt no longer matches its digest', () => {
    const receipt = buildReceipt({
      baseUrl,
      readAt,
      probes: [
        { name: 'health', method: 'GET', path: '/api/health', status: 200, body: { note: DSN } },
      ],
    });
    expect(JSON.stringify(receipt)).not.toContain('hunter2');
    expect(verifyReceipt(receipt)).toBe(true);
    expect(verifyReceipt({ ...receipt, verdict: 'healthy' })).toBe(false);
  });

  it('keyed digests cannot be recomputed without the key', () => {
    const probes = [{ name: 'health', method: 'GET', path: '/api/health', status: 200, body: {} }];
    const signed = buildReceipt({ baseUrl, readAt, probes, signingKey: 'k1' });
    expect(signed.hash_alg).toBe('hmac-sha256');
    expect(verifyReceipt(signed, 'k1')).toBe(true);
    expect(verifyReceipt(signed, 'k2')).toBe(false);
    expect(verifyReceipt(signed)).toBe(false);
    // Recomputing an unkeyed hash over an edited receipt is not a forgery of a keyed one.
    const unsigned = buildReceipt({ baseUrl, readAt, probes });
    expect(verifyReceipt({ ...unsigned, hash_alg: 'hmac-sha256' }, 'k1')).toBe(false);
  });

  it('canonicalises key order so the hash is order-independent', () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe('{"a":[{"c":3,"d":2}],"b":1}');
  });
});

describe('collectRuntimeReceipt', () => {
  function fakeResponse(status: number, body: string, headers: Record<string, string> = {}) {
    return {
      status,
      headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
      text: async () => body,
    };
  }

  it('records login status and cookie flag but never the token', async () => {
    const calls: string[] = [];
    const fetchImpl = async (url: string) => {
      calls.push(url);
      if (url.endsWith('/api/health')) {
        return fakeResponse(200, JSON.stringify({ database: { reachable: true } }));
      }
      if (url.endsWith('/api/auth/login')) {
        return fakeResponse(200, JSON.stringify({ access_token: 'SECRET-TOKEN' }), {
          'set-cookie': 'auth_access=SECRET-COOKIE; Path=/; HttpOnly',
        });
      }
      return fakeResponse(200, '<html>');
    };

    const receipt = await collectRuntimeReceipt({
      baseUrl: 'https://example.test/',
      credentials: { email: 'a@b.c', password: 'pw' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => new Date('2026-09-03T00:00:00Z'),
    });

    const text = JSON.stringify(receipt);
    expect(text).not.toContain('SECRET');
    expect(text).not.toContain('pw');
    expect(receipt.probes.map((p) => p.name)).toEqual(['landing', 'health', 'login']);
    expect(receipt.probes[2]).toMatchObject({ status: 200, session_cookie_set: true });
    expect(receipt.verdict).toBe('healthy');
    expect(calls[0]).toBe('https://example.test/');
  });

  it('records a target that does not answer as status 0 with the error class, and stays unhealthy', async () => {
    // The shape Node actually throws: TypeError('fetch failed') with cause.code.
    const fetchImpl = async () => {
      throw Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }) });
    };
    const receipt = await collectRuntimeReceipt({
      baseUrl: 'https://user:pw@127.0.0.1:9',
      credentials: { email: 'a@b.c', password: 'pw' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(receipt.verdict).toBe('unhealthy');
    expect(receipt.base_url).toBe('https://127.0.0.1:9');
    expect(receipt.probes.map((p) => [p.name, p.status, p.error])).toEqual([
      ['landing', 0, 'TypeError:ECONNREFUSED'],
      ['health', 0, 'TypeError:ECONNREFUSED'],
      ['login', 0, 'TypeError:ECONNREFUSED'],
    ]);
    expect(JSON.stringify(receipt)).not.toContain('user:pw');
  });

  it('moves URL credentials into a Basic header and fetches the stripped URL', async () => {
    const seen: { url: string; auth: string | undefined }[] = [];
    const fetchImpl = async (url: string, init: { headers?: Record<string, string> }) => {
      seen.push({ url, auth: init.headers?.authorization });
      return fakeResponse(200, JSON.stringify({ database: { reachable: true } }));
    };
    const receipt = await collectRuntimeReceipt({
      baseUrl: 'https://user:BASICPW@example.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(receipt.verdict).toBe('healthy');
    expect(seen.map((s) => s.url)).toEqual(['https://example.test/', 'https://example.test/api/health']);
    expect(seen[0].auth).toBe(`Basic ${Buffer.from('user:BASICPW').toString('base64')}`);
    expect(JSON.stringify(receipt)).not.toContain('BASICPW');
  });

  it('skips the login probe without credentials', async () => {
    const fetchImpl = async () => fakeResponse(503, JSON.stringify({ database: { reachable: false } }));
    const receipt = await collectRuntimeReceipt({
      baseUrl: 'https://example.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(receipt.probes.map((p) => p.name)).toEqual(['landing', 'health']);
    expect(receipt.verdict).toBe('unhealthy');
  });
});
