/**
 * Production entry: normalize DATABASE_URL, run migrations, start Next.js.
 * DigitalOcean only injects env at runtime — do not rely on a .env file in the image.
 */
import { execSync } from 'node:child_process';
import { config } from 'dotenv';

// Local / optional .env — never overrides variables already set by the platform
config();

function normalizeDatabaseUrl(raw) {
  let url = (raw ?? '').trim();
  if (!url) return '';

  if (
    (url.startsWith('"') && url.endsWith('"')) ||
    (url.startsWith("'") && url.endsWith("'"))
  ) {
    url = url.slice(1, -1).trim();
  }

  url = url.replace(/^postgresql\+asyncpg:\/\//i, 'postgresql://');
  url = url.replace(/^postgres\+asyncpg:\/\//i, 'postgresql://');

  // DO UI sometimes copies "user:pass@host:port/db" without the scheme
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url) && url.includes('@')) {
    url = `postgresql://${url.replace(/^\/+/, '')}`;
  }

  return url;
}

const url = normalizeDatabaseUrl(process.env.DATABASE_URL);

if (!url) {
  console.error(
    'FATAL: DATABASE_URL is not set.\n' +
      'In DigitalOcean: App → Settings → Environment Variables → add DATABASE_URL\n' +
      '(Runtime scope), value like:\n' +
      'postgresql://USER:PASSWORD@HOST:25060/defaultdb?sslmode=require'
  );
  process.exit(1);
}

process.env.DATABASE_URL = url;

try {
  const { host, pathname } = new URL(url);
  console.log(`DATABASE_URL ok (host=${host}, db=${pathname})`);
} catch {
  console.error(
    'FATAL: DATABASE_URL is not a valid URL. Use postgresql://user:password@host:port/database?sslmode=require'
  );
  process.exit(1);
}

execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
execSync('npx next start', { stdio: 'inherit', env: process.env });
