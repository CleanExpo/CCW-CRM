/**
 * UNI-2751: server-side fetch that only ever reaches public internet hosts.
 *
 * Staff type competitor URLs, and the server fetches them, so every hop is
 * checked: the scheme must be http(s), the host must resolve only to public
 * addresses, and redirects are followed by hand (at most MAX_REDIRECTS), each
 * re-checked, instead of letting fetch follow them blind.
 *
 * Residual risk, recorded rather than hidden: the address is resolved here and
 * again by fetch, so a hostile DNS server could answer differently between the
 * two lookups (DNS rebinding). Closing that needs connection pinning.
 */
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export class UnsafeUrlError extends Error {}

export type Lookup = (host: string) => Promise<{ address: string; family: number }[]>;
export type FetchImpl = (url: string, init: RequestInit) => Promise<Response>;

const MAX_REDIRECTS = 3;

function ipv4Private(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

/** True for loopback, private, link-local, CGNAT, multicast and reserved ranges. */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return ipv4Private(ip);
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === '::' || x === '::1') return true;
    const mapped = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return ipv4Private(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(x);
  }
  return true; // not an IP at all: refuse rather than guess
}

/** Throws UnsafeUrlError unless the URL is http(s) and its host resolves only to public addresses. */
export async function assertPublicUrl(raw: string, lookup: Lookup = defaultLookup): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new UnsafeUrlError('Not a valid URL');
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new UnsafeUrlError('Only http and https pages can be fetched');
  }
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host);
  if (addresses.length === 0) throw new UnsafeUrlError(`${host} did not resolve`);
  const bad = addresses.find((a) => isPrivateAddress(a.address));
  if (bad) throw new UnsafeUrlError(`${host} resolves to a non-public address (${bad.address})`);
  return u;
}

const defaultLookup: Lookup = (host) => dnsLookup(host, { all: true, verbatim: true });

export function createSafeFetch(opts: {
  lookup?: Lookup;
  fetchImpl?: FetchImpl;
  headers?: Record<string, string>;
  timeoutMs: number;
  maxBodyChars: number;
}) {
  const lookup = opts.lookup ?? defaultLookup;
  const fetchImpl: FetchImpl = opts.fetchImpl ?? ((url, init) => fetch(url, init));
  return async (url: string): Promise<{ status: number; text: string }> => {
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertPublicUrl(current, lookup);
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), opts.timeoutMs);
      try {
        const res = await fetchImpl(current, {
          headers: opts.headers,
          redirect: 'manual',
          signal: controller.signal,
        });
        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get('location');
          if (!loc) return { status: res.status, text: '' };
          current = new URL(loc, current).toString();
          continue;
        }
        const text = (await res.text()).slice(0, opts.maxBodyChars);
        return { status: res.status, text };
      } finally {
        clearTimeout(t);
      }
    }
    throw new UnsafeUrlError(`More than ${MAX_REDIRECTS} redirects`);
  };
}
