import { isLandedCostSku } from '@/lib/phase2/schedule-a';

export type CostBasisPo = {
  shippingCost: number;
  lines: Array<{ sku: string; quantity: number; unitCost: number }>;
};

export type CostSource =
  | 'cin7_average_landed_cost'
  | 'cin7_cost'
  | 'po_unit_cost'
  | 'none';

export type CostBasisRow = {
  sku: string;
  warehouse: string;
  quantity: number;
  unitCost: number | null;
  source: CostSource;
  value: number;
};

export type CostBasis = {
  unitCostBySku: Map<string, number>;
  sourceBySku: Map<string, CostSource>;
  landedPerUnitBySku: Map<string, number>;
  effectiveCostBySku: Map<string, number>;
  landedPoLineTotal: number;
  headerFreightTotal: number;
  landedCostAllocationUnread: true;
};

/**
 * Area 2 uses Cin7's own cost fields. RetailPrice is never a cost.
 * Homemade IMP-* / header freight is recorded, not added on top of Cin7 ALC/Cost
 * (that was the 2.4× self-tie). Route (b) allocation stays unread.
 */
export function buildCostBasis(input: {
  products: Array<{
    sku: string;
    cin7Cost?: number | null;
    cin7AverageLandedCost?: number | null;
  }>;
  orders: CostBasisPo[];
}): CostBasis {
  const unitCostBySku = new Map<string, number>();
  const sourceBySku = new Map<string, CostSource>();

  for (const p of input.products) {
    if (!p.sku) continue;
    const alc = p.cin7AverageLandedCost;
    const cost = p.cin7Cost;
    if (alc != null && alc > 0) {
      unitCostBySku.set(p.sku, alc);
      sourceBySku.set(p.sku, 'cin7_average_landed_cost');
    } else if (cost != null && cost > 0) {
      unitCostBySku.set(p.sku, cost);
      sourceBySku.set(p.sku, 'cin7_cost');
    }
  }

  let landedPoLineTotal = 0;
  let headerFreightTotal = 0;
  const lastPoUnit = new Map<string, number>();

  for (const order of input.orders) {
    const header = Number.isFinite(order.shippingCost) ? Math.max(0, order.shippingCost) : 0;
    headerFreightTotal += header;
    for (const line of order.lines) {
      if (!line.sku) continue;
      if (isLandedCostSku(line.sku)) {
        landedPoLineTotal += line.quantity * line.unitCost;
        continue;
      }
      if (line.unitCost > 0) lastPoUnit.set(line.sku, line.unitCost);
    }
  }

  for (const [sku, unit] of lastPoUnit) {
    if (!unitCostBySku.has(sku)) {
      unitCostBySku.set(sku, unit);
      sourceBySku.set(sku, 'po_unit_cost');
    }
  }

  const landedPerUnitBySku = new Map<string, number>();
  const effectiveCostBySku = new Map<string, number>();
  for (const [sku, unit] of unitCostBySku) {
    landedPerUnitBySku.set(sku, 0);
    effectiveCostBySku.set(sku, unit);
  }

  return {
    unitCostBySku,
    sourceBySku,
    landedPerUnitBySku,
    effectiveCostBySku,
    landedPoLineTotal,
    headerFreightTotal,
    landedCostAllocationUnread: true,
  };
}

export function valuePositions(
  rows: Array<{ sku: string; warehouse: string; warehouseName?: string; stockOnHand: number }>,
  costBySku: Map<string, number>
): { warehouses: Array<{ warehouse: string; value: number }>; qtyWithoutCost: number } {
  const byWh = new Map<string, number>();
  let qtyWithoutCost = 0;
  for (const r of rows) {
    const cost = costBySku.get(r.sku);
    if (cost == null || cost === 0) {
      if (r.stockOnHand !== 0) qtyWithoutCost += 1;
      continue;
    }
    const name = r.warehouseName ?? r.warehouse;
    byWh.set(name, (byWh.get(name) ?? 0) + r.stockOnHand * cost);
  }
  return {
    warehouses: [...byWh.entries()].map(([warehouse, value]) => ({
      warehouse,
      value: Math.round(value * 100) / 100,
    })),
    qtyWithoutCost,
  };
}

export function qld1HighestValueRows(
  rows: Array<{ sku: string; warehouse: string; warehouseName?: string; stockOnHand: number }>,
  basis: CostBasis,
  limit = 20
): CostBasisRow[] {
  const ranked: CostBasisRow[] = [];
  for (const r of rows) {
    const name = r.warehouseName ?? r.warehouse;
    if (!/QLD1/i.test(name)) continue;
    if (r.stockOnHand === 0) continue;
    const unitCost = basis.effectiveCostBySku.get(r.sku) ?? null;
    const source = basis.sourceBySku.get(r.sku) ?? 'none';
    ranked.push({
      sku: r.sku,
      warehouse: name,
      quantity: r.stockOnHand,
      unitCost,
      source: unitCost == null ? 'none' : source,
      value: unitCost == null ? 0 : Math.round(r.stockOnHand * unitCost * 100) / 100,
    });
  }
  ranked.sort((a, b) => b.value - a.value || b.quantity - a.quantity);
  const top = ranked.filter((r) => r.source !== 'none').slice(0, limit);
  const uncosted = ranked.filter((r) => r.source === 'none');
  return [...top, ...uncosted];
}
