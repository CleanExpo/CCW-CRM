import { isLandedCostSku } from '@/lib/phase2/schedule-a';

export type CostBasisPo = {
  shippingCost: number;
  lines: Array<{ sku: string; quantity: number; unitCost: number }>;
};

export type CostBasis = {
  unitCostBySku: Map<string, number>;
  landedPerUnitBySku: Map<string, number>;
  effectiveCostBySku: Map<string, number>;
  landedPoLineTotal: number;
  headerFreightTotal: number;
  landedCostAllocationUnread: true;
};

/**
 * Area 2 route (a): product cost + IMP-* / XFREIGHT-* lines + PO header freight,
 * allocated across that PO's product lines by line value.
 * Route (b) Cin7 Landed Costs allocation is not in the Omni stock walk — left unread.
 */
export function buildCostBasis(input: {
  productPrices: Array<{ sku: string; price: number }>;
  orders: CostBasisPo[];
}): CostBasis {
  const unitCostBySku = new Map<string, number>();
  for (const p of input.productPrices) {
    if (p.sku) unitCostBySku.set(p.sku, p.price);
  }

  let landedPoLineTotal = 0;
  let headerFreightTotal = 0;
  const landedAllocated = new Map<string, { landed: number; qty: number }>();

  for (const order of input.orders) {
    const header = Number.isFinite(order.shippingCost) ? Math.max(0, order.shippingCost) : 0;
    headerFreightTotal += header;
    let lineLanded = 0;
    const productLines: CostBasisPo['lines'] = [];
    for (const line of order.lines) {
      if (!line.sku) continue;
      if (isLandedCostSku(line.sku)) {
        lineLanded += line.quantity * line.unitCost;
        continue;
      }
      productLines.push(line);
      if (line.unitCost > 0) unitCostBySku.set(line.sku, line.unitCost);
    }
    landedPoLineTotal += lineLanded;
    const pool = lineLanded + header;
    const productValue = productLines.reduce((s, l) => s + l.quantity * l.unitCost, 0);
    for (const line of productLines) {
      const share = productValue > 0 ? (line.quantity * line.unitCost) / productValue : 0;
      const add = pool * share;
      const cur = landedAllocated.get(line.sku) ?? { landed: 0, qty: 0 };
      cur.landed += add;
      cur.qty += line.quantity;
      landedAllocated.set(line.sku, cur);
    }
  }

  const landedPerUnitBySku = new Map<string, number>();
  const effectiveCostBySku = new Map<string, number>();
  for (const [sku, unit] of unitCostBySku) {
    const alloc = landedAllocated.get(sku);
    const perUnit = alloc && alloc.qty > 0 ? alloc.landed / alloc.qty : 0;
    landedPerUnitBySku.set(sku, perUnit);
    effectiveCostBySku.set(sku, unit + perUnit);
  }

  return {
    unitCostBySku,
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
