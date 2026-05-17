/**
 * Production entry: DB URL, migrations, start Next (standalone server on DigitalOcean).
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';
import { resolveDatabaseUrl } from './database-url.mjs';

config();
config({ path: '.env.local', override: false });

const result = resolveDatabaseUrl();
if (!result) {
  console.error('FATAL: No database connection configured.');
  console.error('Set DATABASE_URL or DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME.');
  process.exit(1);
}

process.env.DATABASE_URL = result.url;
console.log(
  `DATABASE_URL ok${result.source === 'DB_*' ? ' (from DB_* variables)' : ''} (host=${result.parsed.host})`
);

// DigitalOcean routes traffic to PORT (default 8080). Bind on all interfaces.
process.env.PORT = process.env.PORT || '8080';
process.env.HOSTNAME = process.env.HOSTNAME || '0.0.0.0';

if (process.env.SKIP_PRISMA_MIGRATE !== 'true') {
  try {
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: process.env,
      timeout: 120_000,
    });
  } catch (e) {
    console.error('prisma migrate deploy failed:', e.message);
    process.exit(1);
  }
}

const root = process.cwd();
const standaloneDir = join(root, '.next/standalone');
const standaloneServer = join(standaloneDir, 'server.js');

if (existsSync(standaloneServer)) {
  const staticSrc = join(root, '.next/static');
  const staticDest = join(standaloneDir, '.next/static');
  const publicSrc = join(root, 'public');
  const publicDest = join(standaloneDir, 'public');

  if (existsSync(staticSrc)) {
    cpSync(staticSrc, staticDest, { recursive: true });
  }
  if (existsSync(publicSrc)) {
    cpSync(publicSrc, publicDest, { recursive: true });
  }

  console.log(`Starting standalone server on ${process.env.HOSTNAME}:${process.env.PORT}`);
  execSync('node server.js', { stdio: 'inherit', env: process.env, cwd: standaloneDir });
} else {
  console.log(`Starting next start on ${process.env.HOSTNAME}:${process.env.PORT}`);
  execSync('npx next start', { stdio: 'inherit', env: process.env });
}
