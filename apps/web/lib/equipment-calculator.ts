/**
 * Equipment Calculator — Water Damage Restoration
 *
 * Utility module for computing equipment line-items for restoration
 * and cleaning jobs. Prices are in AUD and reflect CCW catalogue rates.
 *
 * Design contract:
 *   - Negative or NaN quantity inputs are coerced to 0 before calculation.
 *   - Line items with an effective quantity of 0 are excluded from output.
 *   - All monetary values are rounded to 2 decimal places.
 */

// ---------------------------------------------------------------------------
// Equipment catalogue
// ---------------------------------------------------------------------------

export type EquipmentCategory =
  | 'extraction'
  | 'drying'
  | 'filtration'
  | 'monitoring'
  | 'cleaning'
  | 'containment';

export interface CatalogueItem {
  /** Unique CCW SKU */
  sku: string;
  name: string;
  description: string;
  category: EquipmentCategory;
  /** Daily rate in AUD */
  dailyRate: number;
}

/** Master equipment catalogue. */
export const EQUIPMENT_CATALOGUE: Record<string, CatalogueItem> = {
  AIR_MOVER: {
    sku: 'CCW-AM-100',
    name: 'Air Mover',
    description: 'High-velocity axial air mover for accelerated drying',
    category: 'drying',
    dailyRate: 45.0,
  },
  DEHUMIDIFIER_STANDARD: {
    sku: 'CCW-DH-200',
    name: 'Dehumidifier (Standard)',
    description: 'Low-grain refrigerant dehumidifier — up to 50L/day',
    category: 'drying',
    dailyRate: 75.0,
  },
  DEHUMIDIFIER_LARGE: {
    sku: 'CCW-DH-400',
    name: 'Dehumidifier (Large)',
    description: 'Industrial low-grain refrigerant dehumidifier — up to 120L/day',
    category: 'drying',
    dailyRate: 135.0,
  },
  HEPA_VACUUM: {
    sku: 'CCW-HV-300',
    name: 'HEPA Vacuum',
    description: 'HEPA-filtered vacuum for particulate and mould remediation',
    category: 'filtration',
    dailyRate: 60.0,
  },
  AIR_SCRUBBER: {
    sku: 'CCW-AS-500',
    name: 'Air Scrubber',
    description: 'Negative-pressure air scrubber with HEPA filtration',
    category: 'filtration',
    dailyRate: 90.0,
  },
  MOISTURE_METER: {
    sku: 'CCW-MM-010',
    name: 'Moisture Meter',
    description: 'Digital pin/pinless moisture meter for structural assessment',
    category: 'monitoring',
    dailyRate: 25.0,
  },
  THERMAL_HYGROMETER: {
    sku: 'CCW-TH-020',
    name: 'Thermal Hygrometer',
    description: 'Combination temperature/relative-humidity data logger',
    category: 'monitoring',
    dailyRate: 30.0,
  },
  TRUCK_MOUNT_EXTRACTOR: {
    sku: 'CCW-TM-700',
    name: 'TruckMount Extractor',
    description: 'Van-mounted hot-water extraction unit for carpet and upholstery',
    category: 'extraction',
    dailyRate: 350.0,
  },
  PORTABLE_EXTRACTOR: {
    sku: 'CCW-PE-600',
    name: 'Portable Extractor',
    description: 'Portable carpet extractor for confined or multi-storey access',
    category: 'extraction',
    dailyRate: 110.0,
  },
  CONTAINMENT_BARRIER: {
    sku: 'CCW-CB-050',
    name: 'Containment Barrier Kit',
    description: 'Polyethylene sheeting + zipper door for work-area containment',
    category: 'containment',
    dailyRate: 40.0,
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EquipmentRequest {
  /** Key from EQUIPMENT_CATALOGUE */
  equipmentKey: string;
  /** Number of units — negative values are coerced to 0 */
  quantity: number;
  /** Override duration in days (default: 1) */
  days?: number;
}

export interface EquipmentLineItem {
  sku: string;
  name: string;
  description: string;
  category: EquipmentCategory;
  quantity: number;
  days: number;
  unitDailyRate: number;
  lineTotal: number;
}

export interface EquipmentCalculation {
  lineItems: EquipmentLineItem[];
  subtotal: number;
  /** GST at 10% */
  gst: number;
  total: number;
  currency: 'AUD';
}

// ---------------------------------------------------------------------------
// Core calculation function
// ---------------------------------------------------------------------------

/**
 * Compute equipment rental costs from a list of requests.
 *
 * @param requests - Equipment items with quantities and optional durations.
 * @returns Calculation result including line items and GST totals.
 *
 * @example
 * ```ts
 * const result = calculateEquipment([
 *   { equipmentKey: 'AIR_MOVER', quantity: 4, days: 3 },
 *   { equipmentKey: 'DEHUMIDIFIER_LARGE', quantity: 2, days: 3 },
 *   { equipmentKey: 'HEPA_VACUUM', quantity: 1, days: 3 },
 * ]);
 * ```
 */
export function calculateEquipment(requests: EquipmentRequest[]): EquipmentCalculation {
  const lineItems: EquipmentLineItem[] = [];

  for (const req of requests) {
    const catalogueItem = EQUIPMENT_CATALOGUE[req.equipmentKey];
    if (!catalogueItem) continue;

    // Guard: coerce negative or NaN quantities to 0
    const quantity = Math.max(0, Number.isFinite(req.quantity) ? Math.floor(req.quantity) : 0);
    if (quantity === 0) continue;

    const days = Math.max(1, Number.isFinite(req.days ?? 1) ? Math.floor(req.days ?? 1) : 1);
    const lineTotal = round2(quantity * days * catalogueItem.dailyRate);

    lineItems.push({
      sku: catalogueItem.sku,
      name: catalogueItem.name,
      description: catalogueItem.description,
      category: catalogueItem.category,
      quantity,
      days,
      unitDailyRate: catalogueItem.dailyRate,
      lineTotal,
    });
  }

  const subtotal = round2(lineItems.reduce((sum, li) => sum + li.lineTotal, 0));
  const gst = round2(subtotal * 0.1);
  const total = round2(subtotal + gst);

  return { lineItems, subtotal, gst, total, currency: 'AUD' };
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/**
 * Map a {@link EquipmentCalculation} to a flat array of quote-ready line item
 * objects compatible with the CCW quote creation API.
 */
export function toQuoteLineItems(
  calc: EquipmentCalculation
): Array<{ sku: string; name: string; quantity: number; unit_price: number; line_total: number }> {
  return calc.lineItems.map((li) => ({
    sku: li.sku,
    name: `${li.name} (${li.days}d rental)`,
    quantity: li.quantity,
    unit_price: round2(li.unitDailyRate * li.days),
    line_total: li.lineTotal,
  }));
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
