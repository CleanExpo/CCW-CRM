import type { Prisma } from '@prisma/client';
import type { ProductLocationRow } from '@/lib/db/inventory-product-view';

export const INVENTORY_LOCATION_STOCK_SELECT = {
  location: true,
  quantity: true,
  reserved: true,
  reorderPoint: true,
  reorderQuantity: true,
  leadTimeDays: true,
  autoApproveUnderQty: true,
  reorderEnabled: true,
} satisfies Prisma.ProductLocationStockSelect;

export function toProductLocationRows(
  rows: Array<{
    location: string;
    quantity: number;
    reserved: number;
    reorderPoint: number | null;
    reorderQuantity: number | null;
    leadTimeDays: number;
    autoApproveUnderQty: number;
    reorderEnabled: boolean;
  }>,
): ProductLocationRow[] {
  return rows.map((r) => ({
    location: r.location,
    quantity: r.quantity,
    reserved: r.reserved,
    reorderPoint: r.reorderPoint,
    reorderQuantity: r.reorderQuantity,
    leadTimeDays: r.leadTimeDays,
    autoApproveUnderQty: r.autoApproveUnderQty,
    reorderEnabled: r.reorderEnabled,
  }));
}

export function isMissingInventoryTableError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    /product_location_stock|stock_transfers|stock_reservations|inventory_stock_takes/i.test(msg) &&
    /does not exist|relation|no such table/i.test(msg)
  );
}
