/**
 * Normalize DATABASE_URL for Prisma / node-pg.
 * DigitalOcean and legacy templates sometimes use SQLAlchemy-style schemes or quoting.
 */

const SCHEME_ALIASES: Record<string, string> = {
  "postgresql+asyncpg": "postgresql",
  "postgres+asyncpg": "postgresql",
  "postgresql+psycopg2": "postgresql",
  "postgres+psycopg2": "postgresql",
};

/** Strip whitespace and optional wrapping quotes from env values. */
export function sanitizeEnvValue(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/** Convert SQLAlchemy-style URLs to plain postgresql:// for Prisma. */
export function normalizeDatabaseUrl(raw: string): string {
  const input = sanitizeEnvValue(raw);
  if (!input) {
    throw new Error("DATABASE_URL is empty");
  }

  const match = input.match(/^([a-z][a-z0-9+.-]*):\/\//i);
  if (!match) {
    throw new Error(
      "DATABASE_URL must start with postgresql:// or postgres:// (check for typos, quotes, or missing scheme)"
    );
  }

  const scheme = match[1].toLowerCase();
  const normalizedScheme = SCHEME_ALIASES[scheme] ?? scheme;

  if (normalizedScheme !== "postgresql" && normalizedScheme !== "postgres") {
    throw new Error(
      `DATABASE_URL scheme "${scheme}" is not supported. Use postgresql://user:password@host:port/database?sslmode=require`
    );
  }

  const rest = input.slice(match[0].length);
  const url = `${normalizedScheme}://${rest}`;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
      throw new Error("invalid protocol");
    }
    return url;
  } catch {
    throw new Error(
      "DATABASE_URL is malformed. URL-encode special characters in the password (@ : / # ? &)."
    );
  }
}

/** Build a URL from DigitalOcean / Postgres component env vars when DATABASE_URL is unset. */
export function buildDatabaseUrlFromParts(): string | undefined {
  const host =
    sanitizeEnvValue(process.env.DB_HOST) ??
    sanitizeEnvValue(process.env.PGHOST) ??
    sanitizeEnvValue(process.env.POSTGRES_HOST);
  const user =
    sanitizeEnvValue(process.env.DB_USERNAME) ??
    sanitizeEnvValue(process.env.DB_USER) ??
    sanitizeEnvValue(process.env.PGUSER) ??
    sanitizeEnvValue(process.env.POSTGRES_USER);
  const password =
    sanitizeEnvValue(process.env.DB_PASSWORD) ??
    sanitizeEnvValue(process.env.PGPASSWORD) ??
    sanitizeEnvValue(process.env.POSTGRES_PASSWORD);
  const database =
    sanitizeEnvValue(process.env.DB_NAME) ??
    sanitizeEnvValue(process.env.DB_DATABASE) ??
    sanitizeEnvValue(process.env.PGDATABASE) ??
    sanitizeEnvValue(process.env.POSTGRES_DB) ??
    "defaultdb";
  const port =
    sanitizeEnvValue(process.env.DB_PORT) ??
    sanitizeEnvValue(process.env.PGPORT) ??
    sanitizeEnvValue(process.env.POSTGRES_PORT) ??
    "5432";

  if (!host || !user || !password) return undefined;

  const ssl =
    sanitizeEnvValue(process.env.DB_SSLMODE) ??
    (process.env.NODE_ENV === "production" ? "require" : "prefer");

  const params = new URLSearchParams();
  if (ssl) params.set("sslmode", ssl);

  const auth = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  const query = params.toString();
  return `postgresql://${auth}@${host}:${port}/${database}${query ? `?${query}` : ""}`;
}

/**
 * Resolve the database URL used by Prisma CLI and the app.
 * @param options.required - When false, returns "" if unset (for prisma generate).
 */
export function resolveDatabaseUrl(options?: { required?: boolean }): string {
  const required = options?.required ?? true;
  const direct = sanitizeEnvValue(process.env.DATABASE_URL);

  if (direct) {
    try {
      return normalizeDatabaseUrl(direct);
    } catch (e) {
      const hint =
        direct.includes("+asyncpg") || direct.includes("+psycopg")
          ? " Remove +asyncpg — Prisma needs postgresql:// not postgresql+asyncpg://."
          : "";
      throw new Error(
        `${e instanceof Error ? e.message : "Invalid DATABASE_URL"}.${hint}`
      );
    }
  }

  const built = buildDatabaseUrlFromParts();
  if (built) return built;

  if (!required) return "";

  throw new Error(
    "DATABASE_URL is not configured. Set postgresql://user:password@host:port/database?sslmode=require in your app environment."
  );
}
