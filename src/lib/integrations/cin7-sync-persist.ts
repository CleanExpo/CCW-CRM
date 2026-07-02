import { prisma } from '@/lib/db/prisma';

const DEFAULT_DB_BATCH = 50;

export function getCin7DbBatchSize(): number {
  const n = Number(process.env.CIN7_SYNC_DB_BATCH || DEFAULT_DB_BATCH);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_DB_BATCH;
  return Math.min(100, Math.floor(n));
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

/** Batch upsert products by owner+sku (2 queries per batch vs 2 per row). */
export async function batchUpsertProducts(
  ownerUserId: string,
  rows: Cin7ProductSyncRow[]
): Promise<number> {
  if (rows.length === 0) return 0;

  const batchSize = getCin7DbBatchSize();
  let processed = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    await prisma.$transaction(
      chunk.map((row) =>
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
      )
    );
    processed += chunk.length;
  }

  return processed;
}

/** Batch upsert customers — one lookup per page chunk, then createMany + batched updates. */
export async function batchUpsertCustomers(
  ownerUserId: string,
  rows: Cin7CustomerSyncRow[]
): Promise<number> {
  if (rows.length === 0) return 0;

  const batchSize = getCin7DbBatchSize();
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
        await prisma.$transaction(
          toUpdate.map((r) =>
            prisma.customer.update({
              where: { id: byEmail.get(r.email.trim().toLowerCase())! },
              data: {
                companyName: r.companyName,
                phone: r.phone,
                city: r.city,
              },
            })
          )
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
    });
  }
  return out;
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
): Cin7ProductSyncRow[] {
  return rows
    .map((row) => ({
      sku: row.sku.trim(),
      name: row.name.trim() || row.sku.trim(),
      price: row.price,
      stock: row.stock,
      category: 'Cin7 Omni',
    }))
    .filter((row) => row.sku);
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
