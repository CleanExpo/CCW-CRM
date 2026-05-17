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
