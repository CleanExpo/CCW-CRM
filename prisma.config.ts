/**
 * Prisma ORM 7+ — database URL lives here (not in schema.prisma).
 * Used by the Prisma CLI (migrate, generate, db push).
 */
import "dotenv/config";
import { defineConfig } from "prisma/config";
import { resolveDatabaseUrl } from "./src/lib/db/database-url";

/**
 * Use `process.env` (not `env()` from prisma/config) so `prisma generate` works
 * when DATABASE_URL is unset (e.g. CI install, fresh clone). Migrate/db commands
 * still require a real URL at runtime.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: resolveDatabaseUrl({ required: false }),
  },
});
