import { getDatabaseConnectionString, getPgSslConfig } from '@/lib/db/database-env';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

/** Bump when a schema change requires discarding the dev global PrismaClient cache. */
const PRISMA_CLIENT_SCHEMA_VERSION = 5;

function customerModelHasCin7ContactId(): boolean {
  return (
    Prisma.dmmf.datamodel.models
      .find((model) => model.name === 'Customer')
      ?.fields.some((field) => field.name === 'cin7ContactId') ?? false
  );
}

function prismaModelsIncludeCin7SyncRun(): boolean {
  return Prisma.dmmf.datamodel.models.some((model) => model.name === 'Cin7SyncRun');
}

function createPrismaClient(): PrismaClient {
  if (!customerModelHasCin7ContactId()) {
    throw new Error(
      'Prisma Client is out of date (missing Customer.cin7ContactId). Run `npx prisma generate`, delete `.next`, and restart the dev server.'
    );
  }

  if (!prismaModelsIncludeCin7SyncRun()) {
    throw new Error(
      'Prisma Client is out of date (missing Cin7SyncRun). Run `npx prisma migrate deploy`, `npx prisma generate`, delete `.next`, and restart the dev server.'
    );
  }

  const connectionString = getDatabaseConnectionString();
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }

  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = connectionString;
  }

  const ssl = getPgSslConfig();

  const pool =
    globalForPrisma.pgPool ??
    new Pool({
      connectionString,
      ssl,
      max: 5,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 10_000,
    });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.pgPool = pool;
  }

  const adapter = new PrismaPg(pool);

  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
  (client as PrismaClient & { __ccwSchemaVersion?: number }).__ccwSchemaVersion =
    PRISMA_CLIENT_SCHEMA_VERSION;
  return client;
}

/** Dev hot-reload can keep an old PrismaClient missing models/fields added after the server started. */
function isPrismaClientStale(client: PrismaClient): boolean {
  if (!customerModelHasCin7ContactId() || !prismaModelsIncludeCin7SyncRun()) {
    return true;
  }

  const versioned = client as PrismaClient & { __ccwSchemaVersion?: number };
  if (versioned.__ccwSchemaVersion !== PRISMA_CLIENT_SCHEMA_VERSION) {
    return true;
  }

  if (
    typeof (client as PrismaClient & { workspaceXeroConnection?: unknown })
      .workspaceXeroConnection === 'undefined'
  ) {
    return true;
  }

  return false;
}

async function disposePrismaClient(client: PrismaClient | undefined): Promise<void> {
  if (!client) return;
  try {
    await client.$disconnect();
  } catch {
    // ignore disconnect errors during hot reload
  }
}

function getPrismaClient(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing && !isPrismaClientStale(existing)) {
    return existing;
  }

  if (existing) {
    void disposePrismaClient(existing);
    globalForPrisma.prisma = undefined;
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
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});
