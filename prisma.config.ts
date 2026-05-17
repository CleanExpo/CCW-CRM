/**
 * Prisma ORM 7+ — database URL lives here (not in schema.prisma).
 */
import { createRequire } from 'node:module';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

const require = createRequire(import.meta.url);
const { resolveDatabaseUrl } = require('./scripts/database-url.mjs') as {
  resolveDatabaseUrl: () => { url: string } | null;
};

loadEnv();
loadEnv({ path: '.env.local', override: false });

const resolved = resolveDatabaseUrl();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: resolved?.url ?? '',
  },
});
