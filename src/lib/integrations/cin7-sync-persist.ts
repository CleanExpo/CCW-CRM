import { prisma } from '@/lib/db/prisma';

/** Smaller default — remote managed Postgres (e.g. DigitalOcean) often exceeds Prisma's 5s tx limit at 50 upserts. */
const DEFAULT_DB_BATCH = 20;
const DEFAULT_DB_CONCURRENCY = 10;

export function getCin7DbBatchSize(): number {
  const n = Number(process.env.CIN7_SYNC_DB_BATCH || DEFAULT_DB_BATCH);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_DB_BATCH;
  return Math.min(100, Math.floor(n));
}

export function getCin7DbConcurrency(): number {
  const n = Number(process.env.CIN7_SYNC_DB_CONCURRENCY || DEFAULT_DB_CONCURRENCY);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_DB_CONCURRENCY;
  return Math.min(25, Math.floor(n));
}

/** Run async work in limited parallel chunks (avoids Prisma interactive tx timeout on remote DB). */
async function runInConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<unknown>
): Promise<void> {
  const limit = Math.max(1, concurrency);
  for (let i = 0; i < items.length; i += limit) {
    await Promise.all(items.slice(i, i + limit).map(fn));
  }
}

export type Cin7ProductSyncRow = {
  sku: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  isActive: boolean;
};

export type Cin7CustomerSyncRow = {
  cin7ContactId: string;
  cin7ContactType?: string;
  companyName: string;
  email: string;
  phone?: string;
  city?: string;
};

export type Cin7BranchSyncRow = {
  cin7BranchId: string;
  name: string;
  branchType?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  postCode?: string;
  isActive: boolean;
};

export type Cin7SupplierSyncRow = {
  cin7ContactId: string;
  supplierCode: string;
  companyName: string;
  email?: string;
  phone?: string;
};

export function cin7SupplierCode(cin7ContactId: string): string {
  return `cin7:${cin7ContactId}`;
}

/** Batch upsert products by owner+sku — concurrent upserts, no multi-statement transaction. */
export async function batchUpsertProducts(
  ownerUserId: string,
  rows: Cin7ProductSyncRow[]
): Promise<number> {
  if (rows.length === 0) return 0;

  const batchSize = getCin7DbBatchSize();
  const concurrency = getCin7DbConcurrency();
  let processed = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    await runInConcurrency(chunk, concurrency, (row) =>
      prisma.product.upsert({
        where: { ownerUserId_sku: { ownerUserId, sku: row.sku } },
        create: {
          ownerUserId,
          sku: row.sku,
          name: row.name,
          price: row.price,
          stock: row.stock,
          category: row.category,
          isActive: row.isActive,
        },
        update: {
          name: row.name,
          price: row.price,
          stock: row.stock,
          category: row.category,
          isActive: row.isActive,
        },
      })
    );
    processed += chunk.length;
  }

  return processed;
}

/**
 * Upsert customers by Cin7 contact id (primary) or email (legacy match).
 * Never bulk-creates duplicate rows for contacts without email.
 */
export async function batchUpsertCustomers(
  ownerUserId: string,
  rows: Cin7CustomerSyncRow[]
): Promise<number> {
  if (rows.length === 0) return 0;

  const batchSize = getCin7DbBatchSize();
  const concurrency = getCin7DbConcurrency();
  let processed = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const cin7Ids = chunk.map((r) => r.cin7ContactId);
    const emails = chunk
      .map((r) => r.email.trim().toLowerCase())
      .filter((email) => email.length > 0);

    const [byCin7Rows, byEmailRows] = await Promise.all([
      prisma.customer.findMany({
        where: { ownerUserId, cin7ContactId: { in: cin7Ids } },
        select: { id: true, cin7ContactId: true },
      }),
      emails.length
        ? prisma.customer.findMany({
            where: {
              ownerUserId,
              OR: emails.map((email) => ({ email: { equals: email, mode: 'insensitive' as const } })),
            },
            select: { id: true, email: true, cin7ContactId: true },
          })
        : Promise.resolve([]),
    ]);

    const idByCin7 = new Map(
      byCin7Rows.filter((r) => r.cin7ContactId).map((r) => [r.cin7ContactId!, r.id])
    );
    const idByEmail = new Map(
      byEmailRows
        .filter((r) => r.email)
        .map((r) => [r.email!.trim().toLowerCase(), r.id])
    );

    await runInConcurrency(chunk, concurrency, async (row) => {
      const email = row.email.trim() || null;
      const data = {
        companyName: row.companyName,
        email,
        phone: row.phone,
        city: row.city,
        cin7ContactId: row.cin7ContactId,
        cin7ContactType: row.cin7ContactType,
      };

      const existingId =
        idByCin7.get(row.cin7ContactId) ??
        (email ? idByEmail.get(email.toLowerCase()) : undefined);

      if (existingId) {
        await prisma.customer.update({ where: { id: existingId }, data });
      } else {
        await prisma.customer.create({ data: { ownerUserId, ...data } });
      }
    });

    processed += chunk.length;
  }

  return processed;
}

/** Upsert Cin7 Omni branches by stable branch id. */
export async function batchUpsertBranches(
  ownerUserId: string,
  rows: Cin7BranchSyncRow[]
): Promise<number> {
  if (rows.length === 0) return 0;

  const batchSize = getCin7DbBatchSize();
  const concurrency = getCin7DbConcurrency();
  let processed = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    await runInConcurrency(chunk, concurrency, (row) =>
      prisma.cin7Branch.upsert({
        where: {
          ownerUserId_cin7BranchId: {
            ownerUserId,
            cin7BranchId: row.cin7BranchId,
          },
        },
        create: {
          ownerUserId,
          cin7BranchId: row.cin7BranchId,
          name: row.name,
          branchType: row.branchType,
          email: row.email,
          phone: row.phone,
          city: row.city,
          state: row.state,
          postCode: row.postCode,
          isActive: row.isActive,
        },
        update: {
          name: row.name,
          branchType: row.branchType,
          email: row.email,
          phone: row.phone,
          city: row.city,
          state: row.state,
          postCode: row.postCode,
          isActive: row.isActive,
        },
      })
    );
    processed += chunk.length;
  }

  return processed;
}

export async function recordCin7SyncRun(input: {
  ownerUserId: string;
  entityType: string;
  recordsProcessed: number;
  skipped?: Record<string, number>;
  durationMs: number;
  source?: string;
}): Promise<void> {
  await prisma.cin7SyncRun.create({
    data: {
      ownerUserId: input.ownerUserId,
      entityType: input.entityType,
      recordsProcessed: input.recordsProcessed,
      skipped: input.skipped ?? undefined,
      durationMs: input.durationMs,
      source: input.source,
    },
  });
}
export async function batchUpsertSuppliers(
  ownerUserId: string,
  rows: Cin7SupplierSyncRow[]
): Promise<number> {
  if (rows.length === 0) return 0;

  const batchSize = getCin7DbBatchSize();
  const concurrency = getCin7DbConcurrency();
  let processed = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    await runInConcurrency(chunk, concurrency, (row) =>
      prisma.supplier.upsert({
        where: {
          ownerUserId_supplierCode: {
            ownerUserId,
            supplierCode: row.supplierCode,
          },
        },
        create: {
          ownerUserId,
          supplierCode: row.supplierCode,
          companyName: row.companyName,
          email: row.email,
          phone: row.phone,
          isActive: true,
        },
        update: {
          companyName: row.companyName,
          email: row.email,
          phone: row.phone,
          isActive: true,
        },
      })
    );
    processed += chunk.length;
  }

  return processed;
}

export function mapCoreProductRows(
  rows: Array<{
    Sku?: string;
    Name?: string;
    Price?: number;
    SellPrice?: number;
    Available?: number;
  }>
): Cin7ProductSyncRow[] {
  const out: Cin7ProductSyncRow[] = [];
  for (const row of rows) {
    const sku = String(row.Sku ?? '').trim();
    if (!sku) continue;
    out.push({
      sku,
      name: String(row.Name ?? sku).trim() || sku,
      price: Number(row.Price ?? row.SellPrice ?? 0) || 0,
      stock: Math.max(0, Math.floor(Number(row.Available ?? 0))),
      category: 'Cin7',
      isActive: true,
    });
  }
  return out;
}

export function mapCoreCustomerRows(
  rows: Array<{ ID?: string; Name?: string; Email?: string; Phone?: string; City?: string }>
): Cin7CustomerSyncRow[] {
  const out: Cin7CustomerSyncRow[] = [];
  for (const row of rows) {
    const cin7ContactId = String(row.ID ?? '').trim();
    if (!cin7ContactId) continue;
    out.push({
      cin7ContactId,
      cin7ContactType: 'Cin7',
      companyName: String(row.Name ?? 'Cin7 customer').trim() || 'Cin7 customer',
      email: row.Email ? String(row.Email).trim() : '',
      phone: row.Phone ? String(row.Phone).trim() : undefined,
      city: row.City ? String(row.City).trim() : undefined,
    });
  }
  return out;
}

export function mapOmniProductRows(
  rows: Array<{
    sku: string;
    name: string;
    price: number;
    stock: number;
    visibility: string;
    isActive: boolean;
  }>
): Cin7ProductSyncRow[] {
  return rows
    .map((row) => ({
      sku: row.sku.trim(),
      name: row.name.trim() || row.sku.trim(),
      price: row.price,
      stock: row.stock,
      category: `Cin7 Omni · ${row.visibility}`,
      isActive: row.isActive,
    }))
    .filter((row) => row.sku);
}

export function mapOmniCustomerRows(
  rows: Array<{
    cin7ContactId: string;
    contactType: string;
    companyName: string;
    email: string;
    phone?: string;
    city?: string;
  }>
): Cin7CustomerSyncRow[] {
  return rows.map((row) => ({
    cin7ContactId: row.cin7ContactId,
    cin7ContactType: row.contactType,
    companyName: row.companyName,
    email: row.email?.trim() ?? '',
    phone: row.phone,
    city: row.city,
  }));
}

export function mapOmniBranchRows(
  rows: Array<{
    cin7BranchId: string;
    name: string;
    branchType?: string;
    email?: string;
    phone?: string;
    city?: string;
    state?: string;
    postCode?: string;
    isActive: boolean;
  }>
): Cin7BranchSyncRow[] {
  return rows.map((row) => ({
    cin7BranchId: row.cin7BranchId,
    name: row.name,
    branchType: row.branchType,
    email: row.email,
    phone: row.phone,
    city: row.city,
    state: row.state,
    postCode: row.postCode,
    isActive: row.isActive,
  }));
}

export function mapOmniSupplierRows(
  rows: Array<{
    cin7ContactId: string;
    companyName: string;
    email: string;
    phone?: string;
  }>
): Cin7SupplierSyncRow[] {
  return rows.map((row) => ({
    cin7ContactId: row.cin7ContactId,
    supplierCode: cin7SupplierCode(row.cin7ContactId),
    companyName: row.companyName,
    email: row.email?.trim() || undefined,
    phone: row.phone,
  }));
}
