/**
 * UNI-2751: server-side fetch that only ever reaches public internet hosts.
 *
 * Staff type competitor URLs, and the server fetches them, so every hop is
 * checked: the scheme must be http(s), and redirects are followed by hand (at
 * most MAX_REDIRECTS), each re-checked, instead of letting fetch follow them.
 *
 * DNS rebinding: the address is checked again AT CONNECT TIME. Requests go
 * through node:http/https with a `lookup` hook that rejects any resolved
 * non-public address right before the socket opens, so a DNS answer that flips
 * between the early check and the connection cannot reach an internal host.
 */
import { lookup as dnsLookupCb, type LookupAddress } from 'node:dns';
import { lookup as dnsLookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
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

/** The eight 16-bit groups of an IPv6 address, or null if it cannot be read. */
function ipv6Groups(ip: string): number[] | null {
  let x = ip.toLowerCase().split('%')[0];
  const dotted = x.match(/^(.*:)(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (dotted) {
    const [a, b, c, d] = dotted.slice(2).map(Number);
    x = `${dotted[1]}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = x.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return null;
  const groups = [...head, ...Array<string>(fill).fill('0'), ...tail].map((g) => parseInt(g, 16));
  return groups.length === 8 && groups.every((g) => g >= 0 && g <= 0xffff) ? groups : null;
}

/**
 * True for loopback, private, link-local, CGNAT, multicast and reserved ranges.
 * IPv6 is read group by group, because Node rewrites `[::ffff:127.0.0.1]` in a
 * URL to `::ffff:7f00:1`; a text match on the dotted form misses it.
 */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip.split('%')[0]);
  if (v === 4) return ipv4Private(ip);
  if (v === 6) {
    const g = ipv6Groups(ip);
    if (!g) return true;
    const embedded = `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
    // ::/96 (unspecified, loopback, IPv4-compatible) and ::ffff:0:0/96 (IPv4-mapped)
    if (g.slice(0, 5).every((n) => n === 0) && (g[5] === 0 || g[5] === 0xffff)) {
      return ipv4Private(embedded);
    }
    // 64:ff9b::/96 NAT64 carries an IPv4 address too
    if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((n) => n === 0)) {
      return ipv4Private(embedded);
    }
    // Allow-list: only global unicast (2000::/3) is public. Inside it, refuse the
    // ranges that tunnel or embed another address, where an internal IPv4 can hide:
    // 2002::/16 (6to4), 2001:0::/32 (Teredo) and 2001:db8::/32 (documentation).
    if ((g[0] & 0xe000) !== 0x2000) return true;
    if (g[0] === 0x2002) return true;
    if (g[0] === 0x2001 && (g[1] === 0 || g[1] === 0xdb8)) return true;
    return false;
  }
  return true; // not an IP at all: refuse rather than guess
}

const defaultLookup: Lookup = (host) => dnsLookup(host, { all: true, verbatim: true });

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

type NodeLookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number
) => void;
export type NodeLookup = (
  hostname: string,
  options: { all?: boolean },
  callback: NodeLookupCallback
) => void;

/**
 * A lookup for node:http/https that refuses any non-public address. It runs as
 * the socket connects, which is what closes the DNS-rebinding window.
 */
export function makeGuardedLookup(resolve: Lookup = defaultLookup): NodeLookup {
  return (hostname, options, callback) => {
    resolve(hostname).then(
      (addrs) => {
        const bad = addrs.find((a) => isPrivateAddress(a.address));
        if (addrs.length === 0 || bad) {
          const err = new UnsafeUrlError(
            bad
              ? `${hostname} resolved to a non-public address (${bad.address}) at connect time`
              : `${hostname} did not resolve`
          ) as unknown as NodeJS.ErrnoException;
          callback(err, '');
          return;
        }
        if (options.all) callback(null, addrs as LookupAddress[]);
        else callback(null, addrs[0].address, addrs[0].family);
      },
      (err) => callback(err as NodeJS.ErrnoException, '')
    );
  };
}

/**
 * A fetch over node:http/https whose connections go through the guarded lookup.
 * It stops reading after maxBytes and closes the connection, so an endless or
 * huge page cannot fill memory.
 */
export function createPinnedFetch(
  connectLookup: NodeLookup = makeGuardedLookup(),
  maxBytes = 4_000_000
): FetchImpl {
  return (url, init) =>
    new Promise<Response>((resolve, reject) => {
      const mod = url.startsWith('https:') ? https : http;
      const req = mod.request(
        url,
        {
          method: 'GET',
          headers: init.headers as Record<string, string> | undefined,
          lookup: connectLookup as unknown as typeof dnsLookupCb,
          signal: init.signal ?? undefined,
        },
        (res) => {
          const chunks: Buffer[] = [];
          let size = 0;
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            const raw = res.statusCode ?? 502;
            const status = raw >= 200 && raw <= 599 ? raw : 502;
            const nullBody = [204, 205, 304].includes(status);
            const location = res.headers.location;
            resolve(
              new Response(nullBody ? null : Buffer.concat(chunks), {
                status,
                headers: location ? { location } : {},
              })
            );
          };
          res.on('data', (c: Buffer) => {
            if (done) return;
            const room = maxBytes - size;
            if (c.length >= room) {
              chunks.push(c.subarray(0, room));
              size = maxBytes;
              finish();
              res.destroy();
              return;
            }
            chunks.push(c);
            size += c.length;
          });
          res.on('end', finish);
          res.on('error', (e) => {
            if (!done) reject(e);
          });
        }
      );
      req.on('error', reject);
      req.end();
    });
}

export function createSafeFetch(opts: {
  lookup?: Lookup;
  fetchImpl?: FetchImpl;
  headers?: Record<string, string>;
  timeoutMs: number;
  maxBodyChars: number;
}) {
  const lookup = opts.lookup ?? defaultLookup;
  // A UTF-8 character is at most 4 bytes, so this always holds maxBodyChars.
  const fetchImpl: FetchImpl =
    opts.fetchImpl ?? createPinnedFetch(makeGuardedLookup(lookup), opts.maxBodyChars * 4);
  return async (
    url: string,
    fetchOpts?: { allowRedirect?: (next: URL) => Promise<void> }
  ): Promise<{ status: number; text: string }> => {
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
          const next = new URL(loc, current);
          // The caller decides whether the redirect target may be fetched at all
          // (for Price Mole: robots.txt). Throwing refuses it before any request.
          await fetchOpts?.allowRedirect?.(next);
          current = next.toString();
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
