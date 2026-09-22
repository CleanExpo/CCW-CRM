import type { Phase2AreaReport, Phase2Variance } from '@/lib/phase2/types';
import { PHASE2_AREA_TITLES } from '@/lib/phase2/types';

export type Area1Position = {
  sku: string;
  warehouse: string;
  warehouseName?: string;
  stockOnHand: number;
  available?: number;
  incoming?: number;
};

function keyOf(sku: string, warehouse: string): string {
  return `${warehouse}\u0000${sku}`;
}

function warehouseLabel(row: Area1Position): string {
  return row.warehouseName?.trim() || row.warehouse;
}

/**
 * Stock On Hand by SKU × warehouse. Absent Cin7 row = zero, not missing.
 * Optix holding SOH where Cin7 has no row is extra. Incomplete pull cannot be clean.
 */
export function compareArea1(input: {
  cin7: Area1Position[];
  optix: Area1Position[];
  cin7Complete: boolean;
  asOf?: string;
  incomingInTransit?: Array<{ sku: string; warehouse: string }>;
}): Phase2AreaReport {
  const as_of = input.asOf ?? new Date().toISOString();
  const cin7ByKey = new Map<string, Area1Position>();
  for (const row of input.cin7) {
    if (!row.sku || !row.warehouse) continue;
    cin7ByKey.set(keyOf(row.sku, row.warehouse), row);
  }
  const optixByKey = new Map<string, Area1Position>();
  for (const row of input.optix) {
    if (!row.sku || !row.warehouse) continue;
    optixByKey.set(keyOf(row.sku, row.warehouse), row);
  }

  const inTransit = new Set(
    (input.incomingInTransit ?? []).map((r) => keyOf(r.sku, r.warehouse))
  );

  const sample: Phase2Variance[] = [];
  let missing = 0;
  let extra = 0;
  let quantity_mismatch = 0;
  let timing = 0;

  const warehouseCin7 = new Map<string, number>();
  const warehouseOptix = new Map<string, number>();
  const addWh = (map: Map<string, number>, name: string, qty: number) => {
    map.set(name, (map.get(name) ?? 0) + qty);
  };

  let cin7Company = 0;
  let optixCompany = 0;
  const cin7Skus = new Set<string>();
  const optixSkus = new Set<string>();

  for (const cin7 of cin7ByKey.values()) {
    const name = warehouseLabel(cin7);
    cin7Company += cin7.stockOnHand;
    cin7Skus.add(cin7.sku);
    addWh(warehouseCin7, name, cin7.stockOnHand);
    const optix = optixByKey.get(keyOf(cin7.sku, cin7.warehouse));
    const optixQty = optix?.stockOnHand ?? 0;
    if (!optix && cin7.stockOnHand === 0) {
      continue;
    }
    if (!optix && cin7.stockOnHand !== 0) {
      missing += 1;
      sample.push({
        classification: 'missing_in_optix',
        sku: cin7.sku,
        warehouse: name,
        cin7: cin7.stockOnHand,
        optix: 0,
        difference: -cin7.stockOnHand,
      });
      continue;
    }
    if (optix && optix.stockOnHand !== cin7.stockOnHand) {
      const k = keyOf(cin7.sku, cin7.warehouse);
      if (inTransit.has(k) || (cin7.incoming ?? 0) > 0 || (optix.incoming ?? 0) > 0) {
        timing += 1;
        sample.push({
          classification: 'timing',
          sku: cin7.sku,
          warehouse: name,
          cin7: cin7.stockOnHand,
          optix: optix.stockOnHand,
          difference: optix.stockOnHand - cin7.stockOnHand,
          note: 'In-transit or incoming — Stock On Hand vs Available, not a clean fail.',
        });
        continue;
      }
      quantity_mismatch += 1;
      sample.push({
        classification: 'value_mismatch',
        sku: cin7.sku,
        warehouse: name,
        cin7: cin7.stockOnHand,
        optix: optix.stockOnHand,
        difference: optix.stockOnHand - cin7.stockOnHand,
      });
    }
  }

  for (const optix of optixByKey.values()) {
    const name = warehouseLabel(optix);
    optixCompany += optix.stockOnHand;
    optixSkus.add(optix.sku);
    addWh(warehouseOptix, name, optix.stockOnHand);
    if (cin7ByKey.has(keyOf(optix.sku, optix.warehouse))) continue;
    if (optix.stockOnHand === 0) continue;
    extra += 1;
    sample.push({
      classification: 'extra_in_optix',
      sku: optix.sku,
      warehouse: name,
      cin7: 0,
      optix: optix.stockOnHand,
      difference: optix.stockOnHand,
      note: 'Cin7 has no row; treated as zero. Optix holding stock is the extra case.',
    });
  }

  const warehouseNames = new Set([...warehouseCin7.keys(), ...warehouseOptix.keys()]);
  const warehouses = [...warehouseNames]
    .sort()
    .map((warehouse) => {
      const cin7 = warehouseCin7.get(warehouse) ?? 0;
      const optix = warehouseOptix.get(warehouse) ?? 0;
      return { warehouse, cin7, optix, difference: optix - cin7 };
    });

  const blocked = !input.cin7Complete;
  const varianceCount = missing + extra + quantity_mismatch;
  const clean = !blocked && varianceCount === 0 && cin7Company === optixCompany;

  return {
    area: 1,
    title: PHASE2_AREA_TITLES[1],
    as_of,
    read_only: true,
    cin7_is_source_of_truth: true,
    clean,
    blocked,
    blocked_reason: blocked
      ? 'Incomplete Cin7 stock pull cannot be treated as a clean result.'
      : null,
    cin7_complete: input.cin7Complete,
    company: { cin7: cin7Company, optix: optixCompany, difference: optixCompany - cin7Company },
    sku_count: { cin7: cin7Skus.size, optix: optixSkus.size },
    warehouse_count: { cin7: warehouseCin7.size, optix: warehouseOptix.size },
    warehouses,
    counts: { missing, extra, quantity_mismatch, timing, skipped: 0 },
    sample: sample.slice(0, 50),
    notes: [
      'Compares Stock On Hand, not Available (open Shopify orders allocate Available only).',
      'Active and inactive products are in scope.',
      'A missing Cin7 SKU × warehouse row is zero, not a missing-data exception.',
    ],
    source_of_truth: {
      cin7: 'Cin7 Omni /v1/Stock StockOnHand (complete walk only)',
      optix: 'cin7_stock_levels.stock_on_hand',
    },
  };
}
