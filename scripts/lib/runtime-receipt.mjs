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

import { createHash } from 'node:crypto';

export const RECEIPT_MARKER = 'CCW-RUNTIME-RECEIPT-V1';

const SECRET_KEY_PATTERN = /token|secret|password|cookie|authorization|api[-_]?key/i;
const DSN_PATTERN = /\bpostgres(?:ql)?:\/\/\S+/gi;

/** Strip anything that could carry a credential, recursively. */
export function redact(value) {
  if (typeof value === 'string') {
    return value.replace(DSN_PATTERN, '[redacted-dsn]');
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
 * @property {Probe[]} probes
 * @property {string} sha256
 */

/**
 * Assemble a receipt from probe results. Bodies are redacted before they are
 * recorded; the hash covers the redacted record.
 * @param {{ baseUrl: string, readAt: string, probes: Probe[] }} input
 * @returns {Receipt}
 */
export function buildReceipt({ baseUrl, readAt, probes }) {
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
    base_url: baseUrl,
    verdict: healthy ? 'healthy' : 'unhealthy',
    probes: recorded,
  };
  return { ...receipt, sha256: sha256Hex(canonicalJson(receipt)) };
}

/**
 * Re-derive the hash of a receipt and compare.
 * @param {Receipt} receipt
 */
export function verifyReceipt(receipt) {
  const { sha256, ...rest } = receipt;
  return typeof sha256 === 'string' && sha256Hex(canonicalJson(rest)) === sha256;
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
 * Run the probes against a deployment. `fetchImpl` is injectable for tests.
 * Login is attempted only when both credentials are present; the receipt
 * records the status and whether a session cookie was set, nothing else.
 * @param {{
 *   baseUrl: string,
 *   credentials?: { email: string, password: string } | null,
 *   fetchImpl?: typeof fetch,
 *   now?: () => Date,
 * }} options
 * @returns {Promise<Receipt>}
 */
export async function collectRuntimeReceipt({
  baseUrl,
  credentials = null,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
}) {
  const base = baseUrl.replace(/\/+$/, '');
  /** @type {Probe[]} */
  const probes = [];

  const landing = await fetchImpl(`${base}/`, { method: 'GET', redirect: 'manual' });
  probes.push({ name: 'landing', method: 'GET', path: '/', status: landing.status });

  const health = await fetchImpl(`${base}/api/health`, { method: 'GET' });
  probes.push({
    name: 'health',
    method: 'GET',
    path: '/api/health',
    status: health.status,
    body: await readJsonBody(health),
  });

  if (credentials?.email && credentials?.password) {
    const login = await fetchImpl(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: credentials.email, password: credentials.password }),
      redirect: 'manual',
    });
    // Drain without recording: the body carries the access token.
    await login.text().catch(() => undefined);
    const setCookie = login.headers.get('set-cookie') ?? '';
    probes.push({
      name: 'login',
      method: 'POST',
      path: '/api/auth/login',
      status: login.status,
      session_cookie_set: /auth[_-]?access|access_token/i.test(setCookie),
    });
  }

  return buildReceipt({ baseUrl: base, readAt: now().toISOString(), probes });
}
