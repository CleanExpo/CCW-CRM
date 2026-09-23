/**
 * Schedule A Rev 1 (23 Sep 2026) — Toby. Supersedes the morning copy.
 * Forms part of v1.1 when both are signed. This file is the machine copy of his answers.
 */

export const SCHEDULE_A = {
  revision: 1,
  date: '2026-09-23',
  author: 'Toby Bredhauer',
  supersedes: 'Schedule A copy sent the morning of 23 Sep 2026',
  signed: false,
} as const;

export const USED_EQUIPMENT_SKU = '700-MISC';
export const ABERFORD_HOLDINGS = /aberford\s+holdings/i;

export const LANDED_COST_SKU_PREFIXES = ['IMP-', 'XFREIGHT-'] as const;

export const WORKSHOP_LABOUR_SKUS = ['XLABOUR', 'XLABOUR-OS', 'XLABOUR-BOM'] as const;

export const PHASE2_BRANCHES = [
  { id: '3', name: 'CCW - QLD1 (Boondall)', status: 'active', kind: 'physical' },
  { id: '6', name: 'CCW - VIC1 (Bayswater North)', status: 'active', kind: 'physical' },
  { id: '5', name: 'CCW - NSW1 (Seven Hills)', status: 'active', kind: 'physical' },
  { id: '6503', name: 'PFS-Offshore (Cavite, FCMI)', status: 'active', kind: 'physical_temporary' },
  { id: '19561', name: 'CCW - Shopify', status: 'active', kind: 'virtual' },
  { id: '6513', name: 'SHIP VIA – (AWA) American Worldwide Agencies', status: 'active', kind: 'in_transit' },
  { id: '15108', name: 'AWA (for CCW) Shenzhen Jifang', status: 'active', kind: 'in_transit' },
  { id: '16377', name: 'SHIP VIA – Shipito Torrance CA', status: 'active', kind: 'in_transit' },
  { id: '15469', name: 'SHIP VIA – SM-2548-1714 Oregon', status: 'disabled', kind: 'in_transit' },
  { id: '22453', name: 'POWERFORCE – VIC2 (CLOSED)', status: 'disabled', kind: 'physical_closed' },
  { id: '8', name: 'CCW - OSS1 (QLD)', status: 'disabled', kind: 'closed' },
  { id: '7', name: 'CCW - TAS1', status: 'disabled', kind: 'closed' },
] as const;

export type ScheduleLineKind =
  | 'ordinary'
  | 'trade_in'
  | 'aberford_revaluation'
  | 'landed_cost_po_line'
  | 'workshop_labour'
  | 'zero_price_excluded';

export function classifyPhase2Line(input: {
  sku?: string | null;
  quantity?: number;
  unitPrice?: number;
  customerName?: string | null;
}): ScheduleLineKind {
  const sku = (input.sku ?? '').trim().toUpperCase();
  const customer = input.customerName ?? '';
  if (ABERFORD_HOLDINGS.test(customer)) return 'aberford_revaluation';
  if (sku === USED_EQUIPMENT_SKU && (input.quantity ?? 0) < 0) return 'trade_in';
  if (sku === USED_EQUIPMENT_SKU) return 'trade_in';
  if (LANDED_COST_SKU_PREFIXES.some((p) => sku.startsWith(p))) return 'landed_cost_po_line';
  if ((WORKSHOP_LABOUR_SKUS as readonly string[]).includes(sku)) return 'workshop_labour';
  if ((input.unitPrice ?? 0) === 0 && (input.quantity ?? 0) > 0) return 'zero_price_excluded';
  return 'ordinary';
}

export function isLandedCostSku(sku: string): boolean {
  const upper = sku.trim().toUpperCase();
  return LANDED_COST_SKU_PREFIXES.some((p) => upper.startsWith(p));
}

export const XERO_AREA8 = {
  inventory: ['14000 Inventory', '14000-1 Stock in Transit'],
  dormant: [
    '81000 Opening Stock — $0.00 FY26, archive so it cannot receive postings',
    '83339 Closing Stock — $0.00 FY26, archive so it cannot receive postings',
    '85160 Stock Movement — $0.00 FY26, archive so it cannot receive postings',
  ],
  negative_explained: [
    '82900 COGS Domestic Used Equipment & Vehicles — Part 1.5 trade-in COGS credits',
    '85140 Stock Adjustments — ordinary monthly adjustment journals (Part 1.5)',
  ],
  not_double_booked: true,
  landed_costs_mapping_unset: true,
} as const;

export const AREA3_MONTHLY_BASELINE = [
  { month: '2025-07', count: 521, total_excl: 308776 },
  { month: '2025-08', count: 560, total_excl: 433696 },
  { month: '2025-09', count: 623, total_excl: 446105 },
  { month: '2025-10', count: 601, total_excl: 338937 },
  { month: '2025-11', count: 639, total_excl: 550176 },
  { month: '2025-12', count: 509, total_excl: 499854 },
  { month: '2026-01', count: 639, total_excl: 371921 },
  { month: '2026-02', count: 607, total_excl: 512003 },
  { month: '2026-03', count: 614, total_excl: 621761 },
  { month: '2026-04', count: 579, total_excl: 402762 },
  { month: '2026-05', count: 613, total_excl: 563292 },
  { month: '2026-06', count: 636, total_excl: 412587 },
  { month: '2026-07', count: 578, total_excl: 326638 },
  { month: '2026-08', count: 566, total_excl: 371760 },
  { month: '2026-09', count: 418, total_excl: 277826 },
] as const;
