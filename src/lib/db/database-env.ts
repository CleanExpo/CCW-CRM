import { readFileSync } from "fs";

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

function encodePostgresCredentials(url: string): string {
  const match = url.match(/^(postgres(?:ql)?):\/\/([^/]*?)@(.+)$/i);
  if (!match) return url;

  const creds = match[2];
  const hostPart = match[3];
  const colon = creds.indexOf(":");
  if (colon < 0) return url;

  const user = creds.slice(0, colon);
  const pass = creds.slice(colon + 1);

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${hostPart}`;
}

function parseConnectionUrl(connectionString: string): URL | null {
  try {
    return new URL(connectionString);
  } catch {
    try {
      return new URL(encodePostgresCredentials(connectionString));
    } catch {
      return null;
    }
  }
}

/** Normalize SSL query params (remote → uselibpqcompat=true & sslmode=require). */
export function applyPostgresSslParams(connectionString: string): string {
  const url = parseConnectionUrl(connectionString);
  if (!url) return connectionString;

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

/** SSL options for node-pg Pool (DigitalOcean managed Postgres). */
export function getPgSslConfig(): boolean | { rejectUnauthorized: boolean; ca?: string } {
  const connectionString = getDatabaseConnectionString();
  if (!connectionString) return false;

  const url = parseConnectionUrl(connectionString);
  if (!url) {
    // URL could not be parsed — still use TLS for remote-looking strings
    return { rejectUnauthorized: false };
  }

  const sslmode = url.searchParams.get("sslmode")?.toLowerCase();
  if (sslmode === "disable" || isLocalHost(url.hostname)) {
    return false;
  }

  const caPath = process.env.DB_CA_CERT?.trim();
  if (caPath && process.env.DB_SSL_REJECT_UNAUTHORIZED === "true") {
    try {
      return {
        rejectUnauthorized: true,
        ca: readFileSync(caPath, "utf8"),
      };
    } catch {
      console.warn(`[db] Could not read DB_CA_CERT at ${caPath}, using relaxed TLS`);
    }
  }

  // Required for DigitalOcean: "self-signed certificate in certificate chain" (P1011)
  return { rejectUnauthorized: false };
}
