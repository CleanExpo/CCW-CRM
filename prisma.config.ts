/**
 * Prisma ORM 7+ — database URL lives here (not in schema.prisma).
 * Used by the Prisma CLI (migrate, generate, db push).
 */
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
