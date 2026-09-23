/** Phase 2 v1.1 reconciliation types. Cin7 is source of truth; compares are read-only. */

export const PHASE2_AREAS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export type Phase2Area = (typeof PHASE2_AREAS)[number];

export const PHASE2_AREA_TITLES: Record<Phase2Area, string> = {
  1: 'Inventory quantities by warehouse',
  2: 'Inventory valuation',
  3: 'Sales invoices',
  4: 'Cost of Goods Sold',
  5: 'Customer and supplier balances',
  6: 'Purchase orders and goods receipts',
  7: 'Inventory movements',
  8: 'Xero financial reconciliation',
};

export type Phase2Classification =
  | 'missing_in_optix'
  | 'extra_in_optix'
  | 'value_mismatch'
  | 'timing'
  | 'mapping'
  | 'approved_variance'
  | 'skipped_on_sync';

export type Phase2Variance = {
  classification: Phase2Classification;
  sku?: string;
  warehouse?: string;
  document?: string;
  cin7: number;
  optix: number;
  difference: number;
  note?: string;
};

export type Phase2AreaReport = {
  area: Phase2Area;
  title: string;
  as_of: string;
  read_only: true;
  cin7_is_source_of_truth: true;
  clean: boolean;
  blocked: boolean;
  blocked_reason: string | null;
  cin7_complete: boolean;
  company: { cin7: number; optix: number; difference: number };
  sku_count: { cin7: number; optix: number };
  warehouse_count: { cin7: number; optix: number };
  warehouses: Array<{
    warehouse: string;
    cin7: number;
    optix: number;
    difference: number;
  }>;
  counts: {
    missing: number;
    extra: number;
    quantity_mismatch: number;
    timing: number;
    skipped: number;
  };
  sample: Phase2Variance[];
  notes: string[];
  source_of_truth: { cin7: string; optix: string };
  /** Schedule A Rev 1 own populations — not blended into ordinary sales/COGS. */
  populations?: Record<string, number>;
};

export const HISTORICAL_WINDOW_START = '2025-07-01';
export const LEGACY_OPTIX_ONLY_CUSTOMERS = 3580;
export const APPROVED_VARIANCE_CAP_COUNT = 10;
export const APPROVED_VARIANCE_CAP_AUD = 500;
