/** Resolve PostgreSQL URL from DATABASE_URL or DigitalOcean DB_* variables. */
export function getDatabaseConnectionString(): string {
  const direct = process.env.DATABASE_URL?.trim();
  if (direct) return direct;

  const user = process.env.DB_USER?.trim();
  const password = process.env.DB_PASSWORD?.trim();
  const host = process.env.DB_HOST?.trim();
  const port = process.env.DB_PORT?.trim() || '5432';
  const database =
    process.env.DB_NAME?.trim() || process.env.DB_DATABASE?.trim() || 'defaultdb';

  if (!user || !password || !host) {
    return '';
  }

  const ssl = process.env.DB_SSL?.trim().toLowerCase();
  let sslmode = 'require';
  if (ssl === 'false' || ssl === '0' || ssl === 'disable') sslmode = 'disable';
  else if (ssl === 'prefer') sslmode = 'prefer';

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}?sslmode=${sslmode}`;
}

export function hasDatabaseConfig(): boolean {
  return Boolean(getDatabaseConnectionString());
}

/** SSL for node-pg — DigitalOcean managed Postgres uses a CA that needs this in Node. */
export function getPgSslConfig(): boolean | { rejectUnauthorized: boolean } {
  const connectionString = getDatabaseConnectionString();
  if (!connectionString) return false;

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return false;
  }

  const sslmode = url.searchParams.get("sslmode")?.toLowerCase();
  if (sslmode === "disable") return false;

  const host = url.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return false;
  }

  const needsTls =
    sslmode === "require" ||
    sslmode === "prefer" ||
    sslmode === "verify-ca" ||
    sslmode === "verify-full" ||
    process.env.DB_SSL?.toLowerCase() === "true";

  if (!needsTls) return false;

  // DO / cloud managed DB: avoid "self-signed certificate in certificate chain" (P1011)
  const strict = process.env.DB_SSL_REJECT_UNAUTHORIZED === "true";
  return { rejectUnauthorized: strict };
}
