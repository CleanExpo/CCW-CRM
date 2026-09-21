/** UNI-2751: the server fetch never reaches a non-public address, even via a redirect. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  assertPublicUrl,
  createPinnedFetch,
  createSafeFetch,
  isPrivateAddress,
  makeGuardedLookup,
  UnsafeUrlError,
  type FetchImpl,
  type Lookup,
} from '@/lib/price-mole/safe-fetch';

describe('DNS rebinding — guard', () => {
  let server: http.Server;
  let port = 0;
  let hits = 0;
  beforeAll(async () => {
    server = http.createServer((_req, res) => {
      hits++;
      res.end('internal secret');
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it('refuses at connect time when DNS flips from public to internal after the check', async () => {
    let calls = 0;
    // First answer (the early check) is public; every later answer (the connection) is loopback.
    const rebinding: Lookup = async () => {
      calls++;
      return [{ address: calls === 1 ? '93.184.216.34' : '127.0.0.1', family: 4 }];
    };
    const safe = createSafeFetch({ lookup: rebinding, timeoutMs: 2000, maxBodyChars: 1000 });
    hits = 0;
    await expect(safe(`http://rebind.example:${port}/`)).rejects.toThrow(/connect time/);
    expect(hits).toBe(0);
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it('positive control: the same pinned fetch does connect when the lookup allows the address', async () => {
    // A lookup that skips the guard proves the server and transport work, so the refusal above is the guard.
    const open: Parameters<typeof createPinnedFetch>[0] = (_h, opts, cb) =>
      opts.all ? cb(null, [{ address: '127.0.0.1', family: 4 }]) : cb(null, '127.0.0.1', 4);
    hits = 0;
    const res = await createPinnedFetch(open)(`http://anything.example:${port}/`, {});
    expect(await res.text()).toBe('internal secret');
    expect(hits).toBe(1);
  });

  it('the guarded lookup refuses any private answer, including a mixed one', async () => {
    const lookupOf = (addrs: string[]) =>
      makeGuardedLookup(async () => addrs.map((address) => ({ address, family: 4 })));
    const run = (l: ReturnType<typeof makeGuardedLookup>) =>
      new Promise<string>((resolve) =>
        l('h.example', {}, (err, addr) => resolve(err ? 'refused' : String(addr)))
      );
    expect(await run(lookupOf(['93.184.216.34']))).toBe('93.184.216.34');
    expect(await run(lookupOf(['93.184.216.34', '10.0.0.1']))).toBe('refused');
    expect(await run(lookupOf(['169.254.169.254']))).toBe('refused');
  });
});

describe('response size — guard', () => {
  let server: http.Server;
  let port = 0;
  let closed = false;
  beforeAll(async () => {
    // Streams 64 KB chunks forever until the client hangs up.
    server = http.createServer((_req, res) => {
      const chunk = Buffer.alloc(65_536, 'a');
      const pump = () => {
        if (res.destroyed) return;
        res.write(chunk, () => setImmediate(pump));
      };
      res.on('close', () => {
        closed = true;
      });
      pump();
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it('stops reading an endless page at the byte cap and closes the connection', async () => {
    const open: Parameters<typeof createPinnedFetch>[0] = (_h, opts, cb) =>
      opts.all ? cb(null, [{ address: '127.0.0.1', family: 4 }]) : cb(null, '127.0.0.1', 4);
    const res = await createPinnedFetch(open, 200_000)(`http://endless.example:${port}/`, {});
    const body = await res.text();
    expect(body.length).toBe(200_000);
    await new Promise((r) => setTimeout(r, 50));
    expect(closed).toBe(true);
  }, 5000);
});

const DNS: Record<string, string[]> = {
  'rival.example': ['93.184.216.34'],
  'sneaky.example': ['93.184.216.35', '10.0.0.5'],
  'metadata.example': ['169.254.169.254'],
};
const lookup: Lookup = async (h) => (DNS[h] ?? []).map((address) => ({ address, family: 4 }));

function fakeFetch(routes: Record<string, { status: number; body?: string; location?: string }>) {
  const calls: string[] = [];
  const impl: FetchImpl = async (url) => {
    calls.push(url);
    const r = routes[url];
    if (!r) return new Response('', { status: 404 });
    return new Response(r.body ?? '', {
      status: r.status,
      headers: r.location ? { location: r.location } : {},
    });
  };
  return { impl, calls };
}

const make = (impl: FetchImpl) =>
  createSafeFetch({ lookup, fetchImpl: impl, timeoutMs: 1000, maxBodyChars: 1000 });

describe('isPrivateAddress — guard', () => {
  it('flags loopback, private, link-local, CGNAT, mapped and unique-local addresses', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '::1',
      '::ffff:127.0.0.1',
      'fd00::1',
      'fe80::1',
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ['93.184.216.34', '1.1.1.1', '2606:4700::1111']) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it('refuses every written form of an IPv4-mapped, IPv4-compatible or NAT64 internal address', () => {
    for (const ip of [
      '::ffff:7f00:1',
      '::ffff:a00:1',
      '::ffff:a9fe:a9fe',
      '0:0:0:0:0:ffff:127.0.0.1',
      '::7f00:1',
      '::127.0.0.1',
      '64:ff9b::a00:1',
      'fe80::1%lo0',
      'fec0::1',
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    // Positive control: the same forms carrying a public IPv4 are allowed.
    for (const ip of ['::ffff:5db8:d822', '::ffff:93.184.216.34', '64:ff9b::5db8:d822']) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it('judges the hostname exactly as a URL delivers it', () => {
    const host = (u: string) => new URL(u).hostname.replace(/^\[|\]$/g, '');
    expect(isPrivateAddress(host('http://[::ffff:127.0.0.1]/'))).toBe(true);
    expect(isPrivateAddress(host('http://[::127.0.0.1]/'))).toBe(true);
    expect(isPrivateAddress(host('http://[64:ff9b::10.0.0.1]/'))).toBe(true);
  });
});

describe('safe fetch — guard', () => {
  it('positive control: a public page is fetched', async () => {
    const { impl } = fakeFetch({ 'https://rival.example/p': { status: 200, body: 'ok' } });
    expect(await make(impl)('https://rival.example/p')).toEqual({ status: 200, text: 'ok' });
  });

  it('refuses a redirect to an internal address and never requests it', async () => {
    const { impl, calls } = fakeFetch({
      'https://rival.example/p': { status: 302, location: 'http://127.0.0.1:8080/admin' },
      'http://127.0.0.1:8080/admin': { status: 200, body: 'secret' },
    });
    await expect(make(impl)('https://rival.example/p')).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(calls).toEqual(['https://rival.example/p']);
  });

  it('refuses a redirect to an IPv4-mapped loopback address and never requests it', async () => {
    for (const location of ['http://[::ffff:127.0.0.1]/secret', 'http://[::ffff:7f00:1]/secret']) {
      const { impl, calls } = fakeFetch({
        'https://rival.example/p': { status: 302, location },
        'http://[::ffff:7f00:1]/secret': { status: 200, body: 'INTERNAL' },
      });
      await expect(make(impl)('https://rival.example/p')).rejects.toBeInstanceOf(UnsafeUrlError);
      expect(calls).toEqual(['https://rival.example/p']);
    }
  });

  it('refuses a public-looking name whose DNS answer is an IPv4-mapped internal address', async () => {
    const mapped: Lookup = async () => [{ address: '::ffff:7f00:1', family: 6 }];
    await expect(assertPublicUrl('https://mapped.example/', mapped)).rejects.toThrow(/non-public/);
  });

  it('refuses a redirect to a public-looking name that resolves to cloud metadata', async () => {
    const { impl, calls } = fakeFetch({
      'https://rival.example/p': { status: 301, location: 'https://metadata.example/latest' },
    });
    await expect(make(impl)('https://rival.example/p')).rejects.toThrow(/non-public/);
    expect(calls).toHaveLength(1);
  });

  it('refuses a host where any resolved address is private', async () => {
    await expect(assertPublicUrl('https://sneaky.example/', lookup)).rejects.toThrow(/10\.0\.0\.5/);
  });

  it('refuses non-http schemes and unresolvable hosts', async () => {
    await expect(assertPublicUrl('file:///etc/passwd', lookup)).rejects.toBeInstanceOf(
      UnsafeUrlError
    );
    await expect(assertPublicUrl('https://nowhere.example/', lookup)).rejects.toThrow(
      /did not resolve/
    );
  });

  it('stops after three redirects', async () => {
    const { impl } = fakeFetch({
      'https://rival.example/1': { status: 302, location: '/2' },
      'https://rival.example/2': { status: 302, location: '/3' },
      'https://rival.example/3': { status: 302, location: '/4' },
      'https://rival.example/4': { status: 302, location: '/5' },
    });
    await expect(make(impl)('https://rival.example/1')).rejects.toThrow(/More than 3 redirects/);
  });
});
