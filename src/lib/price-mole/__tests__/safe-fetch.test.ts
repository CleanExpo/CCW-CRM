/** UNI-2751: the server fetch never reaches a non-public address, even via a redirect. */
import { describe, expect, it } from 'vitest';
import {
  assertPublicUrl,
  createSafeFetch,
  isPrivateAddress,
  UnsafeUrlError,
  type FetchImpl,
  type Lookup,
} from '@/lib/price-mole/safe-fetch';

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
