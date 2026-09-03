import { describe, expect, it } from 'vitest';
import {
  RECEIPT_MARKER,
  buildReceipt,
  canonicalJson,
  collectRuntimeReceipt,
  redact,
  verifyReceipt,
} from '../runtime-receipt';

const DSN = 'postgresql://postgres:hunter2@db.example.supabase.co:5432/postgres';

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

  it('hashes the redacted record, so a tampered receipt fails verification', () => {
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
