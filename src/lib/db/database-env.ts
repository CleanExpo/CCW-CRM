/** Resolve PostgreSQL URL from DATABASE_URL or DigitalOcean DB_* variables. */

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/** pg driver: libpq-compatible TLS for managed Postgres (DigitalOcean). */
export const MANAGED_POSTGRES_SSL_QUERY = "uselibpqcompat=true&sslmode=require";

function sslDisabledFromEnv(): boolean {
  const ssl = process.env.DB_SSL?.trim().toLowerCase();
  return ssl === "false" || ssl === "0" || ssl === "disable";
}

/** Normalize SSL query params on any postgres URL (remote → uselibpqcompat + require). */
export function applyPostgresSslParams(connectionString: string): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return connectionString;
  }

  if (isLocalHost(url.hostname) || sslDisabledFromEnv()) {
    url.searchParams.set("sslmode", "disable");
    url.searchParams.delete("uselibpqcompat");
    return url.toString();
  }

  url.searchParams.set("uselibpqcompat", "true");
  url.searchParams.set("sslmode", "require");
  return url.toString();
}

export function getDatabaseConnectionString(): string {
  const direct = process.env.DATABASE_URL?.trim();
  if (direct) {
    return applyPostgresSslParams(direct);
  }

  const user = process.env.DB_USER?.trim();
  const password = process.env.DB_PASSWORD?.trim();
  const host = process.env.DB_HOST?.trim();
  const port = process.env.DB_PORT?.trim() || "5432";
  const database =
    process.env.DB_NAME?.trim() || process.env.DB_DATABASE?.trim() || "defaultdb";

  if (!user || !password || !host) {
    return "";
  }

  const base = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  return applyPostgresSslParams(`${base}?${MANAGED_POSTGRES_SSL_QUERY}`);
}

export function hasDatabaseConfig(): boolean {
  return Boolean(
    process.env.DATABASE_URL?.trim() ||
      (process.env.DB_USER?.trim() &&
        process.env.DB_PASSWORD?.trim() &&
        process.env.DB_HOST?.trim())
  );
}

/** SSL for node-pg Pool (used with uselibpqcompat URL params). */
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
  if (isLocalHost(url.hostname)) return false;

  const strict = process.env.DB_SSL_REJECT_UNAUTHORIZED === "true";
  return { rejectUnauthorized: strict };
}
