/**
 * Resolve PostgreSQL connection URL for Prisma and the app.
 * Uses DATABASE_URL when valid, otherwise builds from DB_* (DigitalOcean style).
 */

export function stripWrappingQuotes(value) {
  let s = (value ?? '').trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

const MANAGED_POSTGRES_SSL_QUERY = 'uselibpqcompat=true&sslmode=require';

function isLocalHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

export function applyPostgresSslParams(connectionString) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    return connectionString;
  }

  const ssl = stripWrappingQuotes(process.env.DB_SSL)?.toLowerCase();
  if (isLocalHost(url.hostname) || ssl === 'false' || ssl === '0' || ssl === 'disable') {
    url.searchParams.set('sslmode', 'disable');
    url.searchParams.delete('uselibpqcompat');
    return url.toString();
  }

  url.searchParams.set('uselibpqcompat', 'true');
  url.searchParams.set('sslmode', 'require');
  return url.toString();
}

export function buildDatabaseUrlFromParts() {
  const user = stripWrappingQuotes(process.env.DB_USER);
  const password = stripWrappingQuotes(process.env.DB_PASSWORD);
  const host = stripWrappingQuotes(process.env.DB_HOST);
  const port = stripWrappingQuotes(process.env.DB_PORT) || '5432';
  const database =
    stripWrappingQuotes(process.env.DB_NAME) ||
    stripWrappingQuotes(process.env.DB_DATABASE) ||
    'defaultdb';

  if (!user || !password || !host) {
    return null;
  }

  const base = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  return applyPostgresSslParams(`${base}?${MANAGED_POSTGRES_SSL_QUERY}`);
}

function encodePostgresCredentials(url) {
  const match = url.match(/^(postgres(?:ql)?):\/\/([^/]*?)@(.+)$/i);
  if (!match) return url;

  const creds = match[2];
  const hostPart = match[3];
  const colon = creds.indexOf(':');
  if (colon < 0) return url;

  const user = creds.slice(0, colon);
  const pass = creds.slice(colon + 1);

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${hostPart}`;
}

function normalizeDatabaseUrl(raw) {
  let url = stripWrappingQuotes(raw);
  if (!url) return '';

  if (url.startsWith('DATABASE_URL=')) {
    url = url.slice('DATABASE_URL='.length).trim();
  }

  url = url.replace(/^postgresql\+asyncpg:\/\//i, 'postgresql://');
  url = url.replace(/^postgres\+asyncpg:\/\//i, 'postgresql://');
  url = url.replace(/^postgres:\/\//i, 'postgresql://');

  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url) && url.includes('@')) {
    url = `postgresql://${url.replace(/^\/+/, '')}`;
  }

  return url;
}

function parseDatabaseUrl(raw) {
  let url = normalizeDatabaseUrl(raw);
  if (!url) return null;

  try {
    url = applyPostgresSslParams(url);
    return { url, parsed: new URL(url) };
  } catch {
    url = encodePostgresCredentials(url);
    try {
      url = applyPostgresSslParams(url);
      return { url, parsed: new URL(url) };
    } catch {
      return null;
    }
  }
}

/** Prefer a valid DATABASE_URL; otherwise build from DB_USER, DB_PASSWORD, DB_HOST, etc. */
export function resolveDatabaseUrl() {
  const fromEnv = process.env.DATABASE_URL;
  if (fromEnv) {
    const parsed = parseDatabaseUrl(fromEnv);
    if (parsed) return { ...parsed, source: 'DATABASE_URL' };
  }

  const built = buildDatabaseUrlFromParts();
  if (built) {
    try {
      new URL(built);
      return { url: built, parsed: new URL(built), source: 'DB_*' };
    } catch {
      return null;
    }
  }

  return null;
}
