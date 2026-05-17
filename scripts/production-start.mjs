/**
 * Production entry: resolve DATABASE_URL, run migrations, start Next.js.
 */
import { execSync } from 'node:child_process';
import { config } from 'dotenv';
import { resolveDatabaseUrl } from './database-url.mjs';

config();
config({ path: '.env.local', override: false });

const result = resolveDatabaseUrl();

if (!result) {
  console.error('FATAL: No database connection configured.');
  console.error(
    'Set either DATABASE_URL or all of: DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME'
  );
  process.exit(1);
}

process.env.DATABASE_URL = result.url;

const source = result.source === 'DB_*' ? ' (from DB_* variables)' : '';
console.log(
  `DATABASE_URL ok${source} (host=${result.parsed.host}, db=${result.parsed.pathname})`
);

execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
execSync('npx next start', { stdio: 'inherit', env: process.env });
