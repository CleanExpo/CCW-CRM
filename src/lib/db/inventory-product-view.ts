import {
  WAREHOUSE_LOCATIONS,
  normalizeWarehouseLocation,
} from '@/lib/db/inventory-location-transfer';

export const DEFAULT_REORDER_THRESHOLD = 20;

export type ProductLocationRow = {
  location: string;
  quantity: number;
  reserved: number;
  reorderPoint: number | null;
  reorderQuantity: number | null;
  leadTimeDays: number;
  autoApproveUnderQty: number;
  reorderEnabled: boolean;
};

export type ExpandedLocation = {
  location: string;
  stock: number;
  reserved: number;
  available: number;
  reorder_point: number;
  reorder_quantity: number;
};

/**
 * Normalise per-location rows to the three warehouse locations. When no location rows exist,
 * treat legacy Product.stock as the primary warehouse only.
 */
export function expandWarehouseLocations(
  productStock: number,
  warehouseLocation: string | null,
  locationStocks: ProductLocationRow[],
): ExpandedLocation[] {
  if (locationStocks.length > 0) {
    const map = new Map(locationStocks.map((r) => [r.location, r]));
    return WAREHOUSE_LOCATIONS.map((loc) => {
      const row = map.get(loc);
      const qty = row?.quantity ?? 0;
      const res = row?.reserved ?? 0;
      const rp = row?.reorderPoint ?? DEFAULT_REORDER_THRESHOLD;
      const rq = row?.reorderQuantity ?? Math.max(DEFAULT_REORDER_THRESHOLD, 10);
      return {
        location: loc,
        stock: qty,
        reserved: res,
        available: Math.max(0, qty - res),
        reorder_point: rp,
        reorder_quantity: rq,
      };
    });
  }

  const primary = normalizeWarehouseLocation(warehouseLocation);
  return WAREHOUSE_LOCATIONS.map((loc) => {
    const qty = loc === primary ? Math.max(0, productStock) : 0;
    return {
      location: loc,
      stock: qty,
      reserved: 0,
      available: qty,
      reorder_point: DEFAULT_REORDER_THRESHOLD,
      reorder_quantity: Math.max(DEFAULT_REORDER_THRESHOLD, 10),
    };
  });
}

export function totalsFromExpanded(locs: ExpandedLocation[]): {
  totalStock: number;
  totalReserved: number;
  totalAvailable: number;
} {
  return {
    totalStock: locs.reduce((s, l) => s + l.stock, 0),
    totalReserved: locs.reduce((s, l) => s + l.reserved, 0),
    totalAvailable: locs.reduce((s, l) => s + l.available, 0),
  };
}

export function countBelowReorderLines(locs: ExpandedLocation[]): number {
  let n = 0;
  for (const l of locs) {
    if (l.available < l.reorder_point) n += 1;
  }
  return n;
}

export function stockHealthBuckets(
  products: Array<{
    id: string;
    sku: string;
    name: string;
    stock: number;
    warehouseLocation: string | null;
    locationStocks: ProductLocationRow[];
  }>,
  threshold: number,
): {
  critical: ReturnType<typeof healthItem>[];
  low: ReturnType<typeof healthItem>[];
  warning: ReturnType<typeof healthItem>[];
} {
  const critical: ReturnType<typeof healthItem>[] = [];
  const low: ReturnType<typeof healthItem>[] = [];
  const warning: ReturnType<typeof healthItem>[] = [];

  for (const p of products) {
    const locs = expandWarehouseLocations(p.stock, p.warehouseLocation, p.locationStocks);
    const { totalStock, totalReserved, totalAvailable } = totalsFromExpanded(locs);
    const minAv = Math.min(...locs.map((l) => l.available));
    const maxAv = Math.max(...locs.map((l) => l.available));
    const locPayload = locs.map((l) => ({
      location: l.location,
      stock: l.stock,
      reserved: l.reserved,
      available: l.available,
      reorder_point: l.reorder_point,
      reorder_quantity: l.reorder_quantity,
    }));

    const base = {
      id: p.id,
      product_id: p.id,
      sku: p.sku,
      product_sku: p.sku,
      name: p.name,
      product_name: p.name,
      stock_by_location: locPayload,
      locations: locPayload,
      total_stock: totalStock,
      total_reserved: totalReserved,
      total_available: totalAvailable,
      min_available: minAv,
    };

    if (totalAvailable <= 0) {
      critical.push(healthItem(base));
      continue;
    }
    if (totalAvailable <= threshold) {
      low.push(healthItem(base));
      continue;
    }
    if (minAv === 0 && maxAv > threshold) {
      warning.push(healthItem(base));
    }
  }

  return { critical, low, warning };
}

type HealthLoc = {
  location: string;
  stock: number;
  reserved: number;
  available: number;
  reorder_point: number;
  reorder_quantity: number;
};

function healthItem(b: {
  id: string;
  product_id: string;
  sku: string;
  product_sku: string;
  name: string;
  product_name: string;
  stock_by_location: HealthLoc[];
  locations: HealthLoc[];
  total_stock: number;
  total_reserved: number;
  total_available: number;
  min_available: number;
}) {
  return { ...b };
}
