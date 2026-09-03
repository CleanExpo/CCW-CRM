/**
 * Runtime receipt for the CCW proof packet (UNI-2483 / UNI-2491).
 *
 * A receipt is a redacted, hashed record of what the deployed application
 * answered at one instant: the landing page, /api/health, and (only when
 * credentials are supplied) whether a login produced a session. It carries
 * status codes and the health payload's shape, never a token, a cookie value,
 * a password or a connection string. The SHA-256 lets the packet cite the
 * receipt by hash instead of by trust.
 */

import { createHash, createHmac } from 'node:crypto';

export const RECEIPT_MARKER = 'CCW-RUNTIME-RECEIPT-V1';

const SECRET_KEY_PATTERN =
  /token|secret|password|passwd|pwd|pass\b|cookie|authorization|auth|key|jwt|bearer|session|credential|dsn|connection|private|service_role/i;
/** `PGPASSWORD=x`, `x-api-key: x`, `client_secret=x` and similar inline pairs. */
const INLINE_PAIR_PATTERN =
  /\b([A-Za-z0-9_-]*(?:key|password|passwd|pwd|secret|token|service_role)[A-Za-z0-9_-]*)\s*[:=]\s*(['"]?)[^\s'"]+\2/gi;
/** Well-known credential prefixes. */
const KNOWN_KEY_PATTERN = /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]+\b|\bAKIA[0-9A-Z]{16}\b|\bxox[baprs]-[A-Za-z0-9-]+\b|\bghp_[A-Za-z0-9]{20,}\b/g;
/** Any URL with userinfo: postgres://u:p@h, mysql://, redis://, https://u:p@h ... */
const URL_WITH_CREDENTIALS_PATTERN = /\b[a-z][a-z0-9+.-]*:\/\/[^\s/@]+@[^\s]*/gi;
/** Three base64url segments starting with the JWT header prefix. */
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\b/g;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const BASIC_PATTERN = /\bBasic\s+[A-Za-z0-9+/=]+/gi;

/** Redact secret-shaped substrings inside free text. */
export function redactText(text) {
  return text
    .replace(URL_WITH_CREDENTIALS_PATTERN, '[redacted-url-with-credentials]')
    .replace(JWT_PATTERN, '[redacted-jwt]')
    .replace(BEARER_PATTERN, 'Bearer [redacted]')
    .replace(BASIC_PATTERN, 'Basic [redacted]')
    .replace(KNOWN_KEY_PATTERN, '[redacted-key]')
    .replace(INLINE_PAIR_PATTERN, '$1=[redacted]');
}

/** Strip anything that could carry a credential, recursively. */
export function redact(value) {
  if (typeof value === 'string') {
    return redactText(value);
  }
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, inner] of Object.entries(value)) {
      out[key] = SECRET_KEY_PATTERN.test(key) ? '[redacted]' : redact(inner);
    }
    return out;
  }
  return value;
}

/** Stable serialisation so the hash does not depend on key order. */
export function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256Hex(text) {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * Hash of the canonical receipt. Without a key this is a plain SHA-256: it
 * detects accidental corruption and lets a reader confirm they hold the same
 * bytes that were cited elsewhere, but anyone can recompute it, so tamper
 * evidence comes from publishing the hash out of band (the Linear comment,
 * the packet) rather than from the receipt itself. With `signingKey` it is an
 * HMAC-SHA256, which only the key holder can recompute.
 */
export function receiptDigest(text, signingKey) {
  if (signingKey) return createHmac('sha256', signingKey).update(text).digest('hex');
  return sha256Hex(text);
}

/** Drop userinfo so `https://user:pw@host` is never recorded. */
export function stripUrlCredentials(baseUrl) {
  try {
    const url = new URL(baseUrl);
    url.username = '';
    url.password = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return redactText(baseUrl).replace(/\/+$/, '');
  }
}

/**
 * @typedef {object} Probe
 * @property {string} name
 * @property {string} method
 * @property {string} path
 * @property {number} status
 * @property {unknown} [body]
 * @property {boolean} [session_cookie_set]
 * @property {string} [error]
 */

/**
 * @typedef {object} Receipt
 * @property {string} marker
 * @property {string} read_at
 * @property {string} base_url
 * @property {'healthy' | 'unhealthy'} verdict
 * @property {'sha256' | 'hmac-sha256'} hash_alg
 * @property {Probe[]} probes
 * @property {string} sha256
 */

/**
 * Assemble a receipt from probe results. Bodies are redacted before they are
 * recorded; the hash covers the redacted record.
 * @param {{ baseUrl: string, readAt: string, probes: Probe[], signingKey?: string | null }} input
 * @returns {Receipt}
 */
export function buildReceipt({ baseUrl, readAt, probes, signingKey = null }) {
  const recorded = probes.map((probe) => {
    /** @type {Probe} */
    const entry = {
      name: probe.name,
      method: probe.method,
      path: probe.path,
      status: probe.status,
    };
    if (probe.body !== undefined) entry.body = redact(probe.body);
    if (probe.session_cookie_set !== undefined) entry.session_cookie_set = probe.session_cookie_set;
    if (probe.error) entry.error = probe.error;
    return entry;
  });

  const health = recorded.find((p) => p.name === 'health');
  const healthBody = /** @type {{ database?: { reachable?: unknown } } | undefined} */ (
    health && health.body && typeof health.body === 'object' ? health.body : undefined
  );
  const healthy = health?.status === 200 && healthBody?.database?.reachable === true;

  const receipt = {
    marker: RECEIPT_MARKER,
    read_at: readAt,
    base_url: stripUrlCredentials(baseUrl),
    verdict: healthy ? 'healthy' : 'unhealthy',
    hash_alg: signingKey ? 'hmac-sha256' : 'sha256',
    probes: recorded,
  };
  return { ...receipt, sha256: receiptDigest(canonicalJson(receipt), signingKey) };
}

/**
 * Re-derive the digest of a receipt and compare. Pass the same `signingKey`
 * the receipt was built with; for an unkeyed receipt this only proves the
 * bytes are intact, not who produced them (see receiptDigest).
 * @param {Receipt} receipt
 * @param {string | null} [signingKey]
 */
export function verifyReceipt(receipt, signingKey = null) {
  const { sha256, ...rest } = receipt;
  if (typeof sha256 !== 'string') return false;
  if ((rest.hash_alg === 'hmac-sha256') !== Boolean(signingKey)) return false;
  return receiptDigest(canonicalJson(rest), signingKey) === sha256;
}

async function readJsonBody(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { non_json_body_length: text.length };
  }
}

/**
 * A probe that cannot even connect is still a probe result: status 0 and the
 * error's class name (never its message, which can carry a URL). The receipt
 * then reads unhealthy instead of the CLI dying with a stack trace.
 */
async function attempt(fetchImpl, url, init) {
  try {
    return { response: await fetchImpl(url, init), error: null };
  } catch (error) {
    const name = error instanceof Error ? error.name : 'Error';
    // Node puts the syscall in cause.code (ECONNREFUSED, ENOTFOUND); fall
    // back to the cause's class name when there is no code.
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause : null;
    // A dual-stack connect failure arrives as an AggregateError; use its first code.
    const first = cause && Array.isArray(cause.errors) ? cause.errors[0] : null;
    const code =
      (cause && typeof cause.code === 'string' && cause.code) ||
      (first && typeof first.code === 'string' && first.code) ||
      cause?.name;
    return { response: null, error: code ? `${name}:${code}` : name };
  }
}

/**
 * fetch() refuses a URL that carries userinfo, so credentials in
 * E2E_BASE_URL are moved into an Authorization header and the URL used for
 * every request is the same stripped one the receipt records.
 */
function splitBaseUrl(baseUrl) {
  const base = stripUrlCredentials(baseUrl);
  try {
    const url = new URL(baseUrl);
    if (url.username || url.password) {
      const pair = `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`;
      return { base, headers: { authorization: `Basic ${Buffer.from(pair).toString('base64')}` } };
    }
  } catch {
    // Not a parseable URL; the stripped string is all we can use.
  }
  return { base, headers: {} };
}

/**
 * Run the probes against a deployment. `fetchImpl` is injectable for tests.
 * Login is attempted only when both credentials are present; the receipt
 * records the status and whether a session cookie was set, nothing else.
 * @param {{
 *   baseUrl: string,
 *   credentials?: { email: string, password: string } | null,
 *   fetchImpl?: typeof fetch,
 *   now?: () => Date,
 *   signingKey?: string | null,
 * }} options
 * @returns {Promise<Receipt>}
 */
export async function collectRuntimeReceipt({
  baseUrl,
  credentials = null,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
  signingKey = null,
}) {
  const { base, headers } = splitBaseUrl(baseUrl);
  /** @type {Probe[]} */
  const probes = [];

  const landing = await attempt(fetchImpl, `${base}/`, { method: 'GET', redirect: 'manual', headers });
  probes.push({
    name: 'landing',
    method: 'GET',
    path: '/',
    status: landing.response?.status ?? 0,
    ...(landing.error ? { error: landing.error } : {}),
  });

  const health = await attempt(fetchImpl, `${base}/api/health`, { method: 'GET', headers });
  probes.push({
    name: 'health',
    method: 'GET',
    path: '/api/health',
    status: health.response?.status ?? 0,
    ...(health.response ? { body: await readJsonBody(health.response) } : { error: health.error }),
  });

  if (credentials?.email && credentials?.password) {
    const login = await attempt(fetchImpl, `${base}/api/auth/login`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ email: credentials.email, password: credentials.password }),
      redirect: 'manual',
    });
    // Drain without recording: the body carries the access token.
    await login.response?.text().catch(() => undefined);
    const setCookie = login.response?.headers.get('set-cookie') ?? '';
    probes.push({
      name: 'login',
      method: 'POST',
      path: '/api/auth/login',
      status: login.response?.status ?? 0,
      session_cookie_set: /auth[_-]?access|access_token/i.test(setCookie),
      ...(login.error ? { error: login.error } : {}),
    });
  }

  return buildReceipt({ baseUrl: base, readAt: now().toISOString(), probes, signingKey });
}
