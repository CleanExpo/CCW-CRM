/**
 * Prisma ORM 7+ — database URL lives here (not in schema.prisma).
 * Production sets DATABASE_URL via the platform; local dev uses .env.
 */
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

if (process.env.NODE_ENV !== 'production') {
  loadEnv();
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
