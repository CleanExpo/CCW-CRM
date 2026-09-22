import type { Phase2Area, Phase2AreaReport, Phase2Variance } from '@/lib/phase2/types';
import {
  HISTORICAL_WINDOW_START,
  LEGACY_OPTIX_ONLY_CUSTOMERS,
  PHASE2_AREA_TITLES,
} from '@/lib/phase2/types';

function emptyReport(
  area: Phase2Area,
  extras: Partial<Phase2AreaReport> & {
    company: Phase2AreaReport['company'];
    notes: string[];
    source_of_truth: Phase2AreaReport['source_of_truth'];
    sample?: Phase2Variance[];
    counts?: Phase2AreaReport['counts'];
    clean: boolean;
    blocked: boolean;
    blocked_reason: string | null;
    cin7_complete: boolean;
  }
): Phase2AreaReport {
  return {
    area,
    title: PHASE2_AREA_TITLES[area],
    as_of: extras.as_of ?? new Date().toISOString(),
    read_only: true,
    cin7_is_source_of_truth: true,
    sku_count: extras.sku_count ?? { cin7: 0, optix: 0 },
    warehouse_count: extras.warehouse_count ?? { cin7: 0, optix: 0 },
    warehouses: extras.warehouses ?? [],
    counts: extras.counts ?? {
      missing: 0,
      extra: 0,
      quantity_mismatch: 0,
      timing: 0,
      skipped: 0,
    },
    sample: extras.sample ?? [],
    ...extras,
  };
}

export function reportValuation(input: {
  cin7ValueByWarehouse: Array<{ warehouse: string; value: number }>;
  optixValueByWarehouse: Array<{ warehouse: string; value: number }>;
  qtyWithoutCost: number;
  cin7Complete: boolean;
  costingNote: string;
}): Phase2AreaReport {
  const cin7Map = new Map(input.cin7ValueByWarehouse.map((r) => [r.warehouse, r.value]));
  const optixMap = new Map(input.optixValueByWarehouse.map((r) => [r.warehouse, r.value]));
  const names = new Set([...cin7Map.keys(), ...optixMap.keys()]);
  const warehouses = [...names].sort().map((warehouse) => {
    const cin7 = cin7Map.get(warehouse) ?? 0;
    const optix = optixMap.get(warehouse) ?? 0;
    return { warehouse, cin7, optix, difference: roundMoney(optix - cin7) };
  });
  const cin7 = roundMoney(input.cin7ValueByWarehouse.reduce((s, r) => s + r.value, 0));
  const optix = roundMoney(input.optixValueByWarehouse.reduce((s, r) => s + r.value, 0));
  const sample: Phase2Variance[] = warehouses
    .filter((w) => Math.abs(w.difference) > 0.005)
    .map((w) => ({
      classification: 'value_mismatch' as const,
      warehouse: w.warehouse,
      cin7: w.cin7,
      optix: w.optix,
      difference: w.difference,
    }));
  const blocked = !input.cin7Complete;
  return emptyReport(2, {
    clean: !blocked && sample.length === 0 && input.qtyWithoutCost === 0,
    blocked,
    blocked_reason: blocked
      ? 'Incomplete Cin7 stock pull cannot be treated as a clean valuation.'
      : null,
    cin7_complete: input.cin7Complete,
    company: { cin7, optix, difference: roundMoney(optix - cin7) },
    warehouse_count: { cin7: cin7Map.size, optix: optixMap.size },
    warehouses,
    counts: {
      missing: 0,
      extra: 0,
      quantity_mismatch: sample.length,
      timing: 0,
      skipped: 0,
    },
    sample: sample.slice(0, 50),
    notes: [
      input.costingNote,
      'Mirrors Cin7 per-product FIFO / Batch / Serial / Non-Stock — not an independent costing engine.',
      input.qtyWithoutCost
        ? `${input.qtyWithoutCost} quantity positions have no cost basis (visible exception).`
        : 'Every quantity position has a cost basis.',
      'Landed cost and FX sit inside Cin7 product cost (E2/E3) before this area can sign off.',
    ],
    source_of_truth: {
      cin7: 'Cin7 product cost × Stock On Hand (same as-of as Area 1)',
      optix: 'Optix stock_on_hand × last known Cin7 unit cost on the product/PO line',
    },
  });
}

export function reportInvoices(input: {
  monthly: Array<{ month: string; cin7Count: number; optixCount: number; cin7Value: number; optixValue: number }>;
  cin7Complete: boolean;
  warrantyUnmarked: boolean;
}): Phase2AreaReport {
  const cin7 = input.monthly.reduce((s, r) => s + r.cin7Value, 0);
  const optix = input.monthly.reduce((s, r) => s + r.optixValue, 0);
  const sample: Phase2Variance[] = input.monthly
    .filter((m) => m.cin7Count !== m.optixCount || Math.abs(m.cin7Value - m.optixValue) > 0.005)
    .map((m) => ({
      classification: 'value_mismatch' as const,
      document: m.month,
      cin7: m.cin7Value,
      optix: m.optixValue,
      difference: roundMoney(m.optixValue - m.cin7Value),
      note: `count Cin7 ${m.cin7Count} / Optix ${m.optixCount}`,
    }));
  return emptyReport(3, {
    clean: input.cin7Complete && sample.length === 0,
    blocked: !input.cin7Complete,
    blocked_reason: input.cin7Complete
      ? null
      : 'Price lists and a complete Cin7 invoice catalog are required before Area 3 can be clean.',
    cin7_complete: input.cin7Complete,
    company: { cin7: roundMoney(cin7), optix: roundMoney(optix), difference: roundMoney(optix - cin7) },
    sku_count: {
      cin7: input.monthly.reduce((s, r) => s + r.cin7Count, 0),
      optix: input.monthly.reduce((s, r) => s + r.optixCount, 0),
    },
    counts: {
      missing: 0,
      extra: 0,
      quantity_mismatch: sample.length,
      timing: 0,
      skipped: 0,
    },
    sample: sample.slice(0, 50),
    notes: [
      `Historical window from ${HISTORICAL_WINDOW_START} (working answer; accountant confirmation pending).`,
      'Channels in scope: Shopify, walk-in counter, phone/email, workshop. No new channel tooling.',
      'Credit notes are their own population (order-derived vs standalone).',
      input.warrantyUnmarked
        ? 'E6 pending: warranty lines look like zero-price failures until Cin7 has a marker.'
        : 'Warranty lines excluded from the pricing-exception check.',
    ],
    source_of_truth: {
      cin7: 'Cin7 sales invoices (all four channels) + monthly count/value',
      optix: 'invoices + invoice_line_items from 1 July 2025',
    },
  });
}

export function reportCogs(input: {
  periodCin7: number;
  periodOptix: number;
  missingZeroCogsLines: number;
  cin7Complete: boolean;
}): Phase2AreaReport {
  const difference = roundMoney(input.periodOptix - input.periodCin7);
  return emptyReport(4, {
    clean: input.cin7Complete && difference === 0 && input.missingZeroCogsLines === 0,
    blocked: !input.cin7Complete,
    blocked_reason: input.cin7Complete
      ? null
      : 'Cin7 COGS is only generated daily when dispatched + dates + accounting status are set (E4).',
    cin7_complete: input.cin7Complete,
    company: {
      cin7: roundMoney(input.periodCin7),
      optix: roundMoney(input.periodOptix),
      difference,
    },
    counts: {
      missing: input.missingZeroCogsLines,
      extra: 0,
      quantity_mismatch: difference === 0 ? 0 : 1,
      timing: 0,
      skipped: 0,
    },
    sample:
      difference === 0
        ? []
        : [
            {
              classification: 'value_mismatch',
              document: 'period COGS',
              cin7: input.periodCin7,
              optix: input.periodOptix,
              difference,
            },
          ],
    notes: [
      'Non-stock: GP cost on the line and COGS sent to Xero are two numbers.',
      'Credits reverse COGS only when stock physically returned.',
      'Warranty and workshop labour are reported as their own populations (E6/E7).',
    ],
    source_of_truth: {
      cin7: 'Cin7 period / invoice / line COGS',
      optix: 'Invoice lines × Cin7 cost basis (not an independent engine)',
    },
  });
}

export function reportBalances(input: {
  arCin7: number;
  arOptix: number;
  apCin7: number;
  apOptix: number;
  legacyExcluded: number;
  cin7Complete: boolean;
}): Phase2AreaReport {
  const arDiff = roundMoney(input.arOptix - input.arCin7);
  const apDiff = roundMoney(input.apOptix - input.apCin7);
  const sample: Phase2Variance[] = [];
  if (arDiff !== 0) {
    sample.push({
      classification: 'value_mismatch',
      document: 'AR control',
      cin7: input.arCin7,
      optix: input.arOptix,
      difference: arDiff,
    });
  }
  if (apDiff !== 0) {
    sample.push({
      classification: 'value_mismatch',
      document: 'AP control',
      cin7: input.apCin7,
      optix: input.apOptix,
      difference: apDiff,
    });
  }
  return emptyReport(5, {
    clean: input.cin7Complete && sample.length === 0,
    blocked: !input.cin7Complete,
    blocked_reason: input.cin7Complete ? null : 'Cin7 AR/AP control totals are required for a clean Area 5.',
    cin7_complete: input.cin7Complete,
    company: {
      cin7: roundMoney(input.arCin7 + input.apCin7),
      optix: roundMoney(input.arOptix + input.apOptix),
      difference: roundMoney(arDiff + apDiff),
    },
    counts: {
      missing: 0,
      extra: 0,
      quantity_mismatch: sample.length,
      timing: 0,
      skipped: input.legacyExcluded,
    },
    sample,
    notes: [
      `In-scope contacts: non-zero balance or a transaction in the window. ${LEGACY_OPTIX_ONLY_CUSTOMERS} legacy Optix-only customers are skipped_on_sync.`,
      'Walk-in paid-at-counter does not sit in AR — only on-account.',
      'AR and AP control totals must tie exactly (zero tolerance).',
    ],
    source_of_truth: {
      cin7: 'Cin7 AR/AP control totals',
      optix: 'Invoice outstanding (total − amount_paid) and supplier bills',
    },
  });
}

export function reportPurchasing(input: {
  poCin7: number;
  poOptix: number;
  grCin7: number;
  grOptix: number;
  cin7Complete: boolean;
}): Phase2AreaReport {
  const sample: Phase2Variance[] = [];
  if (input.poCin7 !== input.poOptix) {
    sample.push({
      classification: 'value_mismatch',
      document: 'Purchase orders',
      cin7: input.poCin7,
      optix: input.poOptix,
      difference: input.poOptix - input.poCin7,
    });
  }
  if (input.grCin7 !== input.grOptix) {
    sample.push({
      classification: 'value_mismatch',
      document: 'Goods receipts',
      cin7: input.grCin7,
      optix: input.grOptix,
      difference: input.grOptix - input.grCin7,
    });
  }
  return emptyReport(6, {
    clean: input.cin7Complete && sample.length === 0,
    blocked: !input.cin7Complete,
    blocked_reason: input.cin7Complete
      ? null
      : 'Complete Cin7 PO/GR catalog (incl. landed cost and FX) required before Area 6 sign-off.',
    cin7_complete: input.cin7Complete,
    company: {
      cin7: input.poCin7 + input.grCin7,
      optix: input.poOptix + input.grOptix,
      difference: input.poOptix + input.grOptix - input.poCin7 - input.grCin7,
    },
    sku_count: { cin7: input.poCin7, optix: input.poOptix },
    counts: {
      missing: 0,
      extra: 0,
      quantity_mismatch: sample.length,
      timing: 0,
      skipped: 0,
    },
    sample,
    notes: [
      'May run in parallel with Areas 2–4; signs off after Area 2.',
      'Purchase returns reverse landed cost as well as unit cost.',
    ],
    source_of_truth: {
      cin7: 'Cin7 purchase orders and goods receipts',
      optix: 'purchase_orders + goods_receipts',
    },
  });
}

export function reportMovements(input: {
  cin7Moves: number;
  optixMoves: number;
  cin7Complete: boolean;
}): Phase2AreaReport {
  const difference = input.optixMoves - input.cin7Moves;
  return emptyReport(7, {
    clean: input.cin7Complete && difference === 0,
    blocked: !input.cin7Complete,
    blocked_reason: input.cin7Complete
      ? null
      : 'Complete Cin7 movement history required. Signs off after Area 4.',
    cin7_complete: input.cin7Complete,
    company: { cin7: input.cin7Moves, optix: input.optixMoves, difference },
    counts: {
      missing: difference < 0 ? -difference : 0,
      extra: difference > 0 ? difference : 0,
      quantity_mismatch: 0,
      timing: 0,
      skipped: 0,
    },
    sample:
      difference === 0
        ? []
        : [
            {
              classification: difference > 0 ? 'extra_in_optix' : 'missing_in_optix',
              document: 'movement rows',
              cin7: input.cin7Moves,
              optix: input.optixMoves,
              difference,
            },
          ],
    notes: [
      'Transfers, adjustments, stocktakes, sales and purchase returns.',
      'COGS reverses on a credit only when stock physically returned.',
    ],
    source_of_truth: {
      cin7: 'Cin7 inventory movements',
      optix: 'stock_movements + stock_transfers',
    },
  });
}

export function reportXero(input: {
  inventoryCin7: number;
  inventoryOptix: number;
  inventoryXero: number | null;
  cogsCin7: number;
  cogsOptix: number;
  cogsXero: number | null;
  e5Agree: boolean | null;
}): Phase2AreaReport {
  const xeroReady = input.inventoryXero != null && input.cogsXero != null;
  const invOk =
    input.inventoryXero != null &&
    Math.abs(input.inventoryCin7 - input.inventoryOptix) < 0.01 &&
    Math.abs(input.inventoryCin7 - input.inventoryXero) < 0.01;
  const cogsOk =
    input.cogsXero != null &&
    Math.abs(input.cogsCin7 - input.cogsOptix) < 0.01 &&
    Math.abs(input.cogsCin7 - input.cogsXero) < 0.01;
  const blocked = input.e5Agree === false || !xeroReady;
  return emptyReport(8, {
    clean: !blocked && invOk && cogsOk,
    blocked,
    blocked_reason:
      input.e5Agree === false
        ? 'E5: Cin7 and Xero already disagree — bookkeeping, not an Optix defect.'
        : !xeroReady
          ? 'Xero figures are not connected. COGS can only agree at monthly-total level.'
          : null,
    cin7_complete: xeroReady,
    company: {
      cin7: input.inventoryCin7,
      optix: input.inventoryOptix,
      difference: roundMoney(input.inventoryOptix - input.inventoryCin7),
    },
    sample: [
      {
        classification: 'value_mismatch',
        document: 'Inventory asset (3-way)',
        cin7: input.inventoryCin7,
        optix: input.inventoryOptix,
        difference: roundMoney(input.inventoryOptix - input.inventoryCin7),
        note: input.inventoryXero == null ? 'Xero not loaded' : `Xero ${input.inventoryXero}`,
      },
      {
        classification: 'value_mismatch',
        document: 'COGS monthly total',
        cin7: input.cogsCin7,
        optix: input.cogsOptix,
        difference: roundMoney(input.cogsOptix - input.cogsCin7),
        note: input.cogsXero == null ? 'Xero not loaded' : `Xero ${input.cogsXero}`,
      },
    ],
    notes: [
      'COGS posts from Cin7 as a monthly manual journal — no line-level Xero agreement.',
      'Cin7 can only push corrections for the past 12 months.',
      'Mapping issues are reported separately from value mismatches.',
    ],
    source_of_truth: {
      cin7: 'Cin7 inventory asset + monthly COGS journal',
      optix: 'Area 2 / Area 4 signed figures vs Xero chart mapping',
    },
  });
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
