import type { Prisma } from '@prisma/client';

export const WAREHOUSE_LOCATIONS = ['brisbane', 'sydney', 'melbourne'] as const;
export type WarehouseLocation = (typeof WAREHOUSE_LOCATIONS)[number];

export function normalizeWarehouseLocation(raw: string | null | undefined): WarehouseLocation {
  const s = (raw ?? 'brisbane').toLowerCase().trim();
  if ((WAREHOUSE_LOCATIONS as readonly string[]).includes(s)) {
    return s as WarehouseLocation;
  }
  return 'brisbane';
}

export function isWarehouseLocation(s: string): s is WarehouseLocation {
  return (WAREHOUSE_LOCATIONS as readonly string[]).includes(s.toLowerCase());
}

/**
 * Ensure one row per warehouse for this product. Seeds from Product.stock into the primary
 * warehouse when rows are missing. Uses createMany + skipDuplicates so concurrent transfers
 * do not fail on unique violations.
 */
export async function ensureProductLocationStockRows(
  tx: Prisma.TransactionClient,
  product: { id: string; stock: number; warehouseLocation: string | null },
): Promise<void> {
  const primary = normalizeWarehouseLocation(product.warehouseLocation);
  await tx.productLocationStock.createMany({
    data: WAREHOUSE_LOCATIONS.map((loc) => ({
      productId: product.id,
      location: loc,
      quantity: loc === primary ? Math.max(0, product.stock) : 0,
      reserved: 0,
    })),
    skipDuplicates: true,
  });
}

export async function syncProductStockTotal(
  tx: Prisma.TransactionClient,
  productId: string,
): Promise<void> {
  const agg = await tx.productLocationStock.aggregate({
    where: { productId },
    _sum: { quantity: true },
  });
  const total = Math.max(0, agg._sum.quantity ?? 0);
  await tx.product.update({
    where: { id: productId },
    data: { stock: total },
  });
}
