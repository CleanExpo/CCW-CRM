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
};

export type Cin7CustomerSyncRow = {
  companyName: string;
  email: string;
  phone?: string;
  city?: string;
};

/** A source row dropped during mapping, with why and a best-effort identifier for the logs. */
export type SkippedRow = { reason: string; identifier: string };

/** Result of mapping product source rows: the rows that will be imported plus the ones skipped. */
export type ProductMapResult = { rows: Cin7ProductSyncRow[]; skipped: SkippedRow[] };

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
          isActive: true,
        },
        update: {
          name: row.name,
          price: row.price,
          stock: row.stock,
        },
      })
    );
    processed += chunk.length;
  }

  return processed;
}

/** Batch upsert customers — one lookup per page chunk, then createMany + concurrent updates. */
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
    const withEmail = chunk.filter((r) => r.email.trim());
    const withoutEmail = chunk.filter((r) => !r.email.trim());

    if (withEmail.length > 0) {
      const emails = withEmail.map((r) => r.email.trim());
      const existing = await prisma.customer.findMany({
        where: { ownerUserId, email: { in: emails } },
        select: { id: true, email: true },
      });
      const byEmail = new Map(
        existing.filter((e) => e.email).map((e) => [e.email!.toLowerCase(), e.id])
      );

      const toCreate = withEmail.filter((r) => !byEmail.has(r.email.trim().toLowerCase()));
      const toUpdate = withEmail.filter((r) => byEmail.has(r.email.trim().toLowerCase()));

      if (toCreate.length > 0) {
        await prisma.customer.createMany({
          data: toCreate.map((r) => ({
            ownerUserId,
            companyName: r.companyName,
            email: r.email.trim(),
            phone: r.phone,
            city: r.city,
          })),
        });
      }

      if (toUpdate.length > 0) {
        await runInConcurrency(toUpdate, concurrency, (r) =>
          prisma.customer.update({
            where: { id: byEmail.get(r.email.trim().toLowerCase())! },
            data: {
              companyName: r.companyName,
              phone: r.phone,
              city: r.city,
            },
          })
        );
      }
    }

    if (withoutEmail.length > 0) {
      await prisma.customer.createMany({
        data: withoutEmail.map((r) => ({
          ownerUserId,
          companyName: r.companyName,
          phone: r.phone,
          city: r.city,
        })),
      });
    }

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
): ProductMapResult {
  const out: Cin7ProductSyncRow[] = [];
  const skipped: SkippedRow[] = [];
  for (const row of rows) {
    const sku = String(row.Sku ?? '').trim();
    if (!sku) {
      skipped.push({
        reason: 'missing_sku',
        identifier: String(row.Name ?? '').trim() || '(unnamed)',
      });
      continue;
    }
    out.push({
      sku,
      name: String(row.Name ?? sku).trim() || sku,
      price: Number(row.Price ?? row.SellPrice ?? 0) || 0,
      stock: Math.max(0, Math.floor(Number(row.Available ?? 0))),
      category: 'Cin7',
    });
  }
  if (skipped.length > 0) {
    console.warn(
      `[Cin7 sync] mapCoreProductRows: skipped ${skipped.length} product row(s) with missing SKU`
    );
  }
  return { rows: out, skipped };
}

export function mapCoreCustomerRows(
  rows: Array<{ Name?: string; Email?: string; Phone?: string; City?: string }>
): Cin7CustomerSyncRow[] {
  return rows.map((row) => ({
    companyName: String(row.Name ?? 'Cin7 customer').trim() || 'Cin7 customer',
    email: row.Email ? String(row.Email).trim() : '',
    phone: row.Phone ? String(row.Phone).trim() : undefined,
    city: row.City ? String(row.City).trim() : undefined,
  }));
}

export function mapOmniProductRows(
  rows: Array<{ sku: string; name: string; price: number; stock: number }>
): ProductMapResult {
  const out: Cin7ProductSyncRow[] = [];
  const skipped: SkippedRow[] = [];
  for (const row of rows) {
    const sku = row.sku.trim();
    if (!sku) {
      skipped.push({ reason: 'missing_sku', identifier: row.name?.trim() || '(unnamed)' });
      continue;
    }
    out.push({
      sku,
      name: row.name.trim() || sku,
      price: row.price,
      stock: row.stock,
      category: 'Cin7 Omni',
    });
  }
  if (skipped.length > 0) {
    console.warn(
      `[Cin7 sync] mapOmniProductRows: skipped ${skipped.length} product row(s) with missing SKU`
    );
  }
  return { rows: out, skipped };
}

export function mapOmniCustomerRows(
  rows: Array<{ companyName: string; email: string; phone?: string; city?: string }>
): Cin7CustomerSyncRow[] {
  return rows.map((row) => ({
    companyName: row.companyName,
    email: row.email?.trim() ?? '',
    phone: row.phone,
    city: row.city,
  }));
}
