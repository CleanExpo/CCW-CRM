/**
 * Normalize Cin7 Omni list responses.
 * Omni returns either a bare array or an envelope with Total + a list key.
 * This parser must never throw and must work for both shapes.
 */

export type Cin7OmniListShape = 'array' | 'envelope' | 'empty';

export type Cin7OmniListParseResult = {
  rows: unknown[];
  /** Authoritative total when the envelope provides it; null for bare arrays / missing. */
  total: number | null;
  shape: Cin7OmniListShape;
};

const TOTAL_KEYS = [
  'Total',
  'total',
  'TotalRecords',
  'totalRecords',
  'Count',
  'count',
  'RecordCount',
  'recordCount',
] as const;

const KNOWN_LIST_KEYS = [
  'Products',
  'products',
  'Contacts',
  'contacts',
  'Branches',
  'branches',
  'ProductCategories',
  'productCategories',
  'Stock',
  'stock',
  'SalesOrders',
  'salesOrders',
  'PurchaseOrders',
  'purchaseOrders',
  'Data',
  'data',
  'Items',
  'items',
  'Results',
  'results',
  'Records',
  'records',
] as const;

function coerceNonNegInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.trim());
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return null;
}

function pickTotal(o: Record<string, unknown>): number | null {
  for (const key of TOTAL_KEYS) {
    if (!(key in o)) continue;
    const n = coerceNonNegInt(o[key]);
    if (n != null) {
      // 0 is a real empty catalog; keep positive totals only for "has more" checks.
      return n > 0 ? n : null;
    }
  }
  return null;
}

/**
 * Parse any Cin7 Omni list payload into `{ rows, total }`.
 * Safe for null/undefined/string/object garbage — never throws.
 */
export function parseCin7OmniListResponse(raw: unknown): Cin7OmniListParseResult {
  try {
    if (raw == null) return { rows: [], total: null, shape: 'empty' };

    if (Array.isArray(raw)) {
      return { rows: raw, total: null, shape: 'array' };
    }

    if (typeof raw !== 'object') {
      return { rows: [], total: null, shape: 'empty' };
    }

    const o = raw as Record<string, unknown>;
    const total = pickTotal(o);

    for (const key of KNOWN_LIST_KEYS) {
      const arr = o[key];
      if (Array.isArray(arr)) {
        return { rows: arr, total, shape: 'envelope' };
      }
    }

    // Unknown envelope key — take the first top-level array value.
    for (const value of Object.values(o)) {
      if (Array.isArray(value)) {
        return { rows: value, total, shape: 'envelope' };
      }
    }

    return { rows: [], total, shape: 'empty' };
  } catch {
    return { rows: [], total: null, shape: 'empty' };
  }
}
