import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { resolveDatabaseUrl } from "@/lib/db/database-url";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = resolveDatabaseUrl();

  const pool =
    globalForPrisma.pgPool ??
    new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 15_000,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pgPool = pool;
  }

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/** Dev hot-reload can keep an old PrismaClient missing models added after the server started. */
function isPrismaClientStale(client: PrismaClient): boolean {
  return typeof (client as PrismaClient & { workspaceXeroConnection?: unknown })
    .workspaceXeroConnection === "undefined";
}

function getPrismaClient(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing && !isPrismaClientStale(existing)) {
    return existing;
  }
  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  return client;
}

/**
 * Lazy Prisma client — does not connect at import time.
 * Next.js runs API route modules during `next build`; DATABASE_URL is often
 * only available at runtime on DigitalOcean, not during the build phase.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = client[prop as keyof PrismaClient];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});
