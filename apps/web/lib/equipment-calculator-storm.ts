/**
 * Equipment Calculator — Storm / Emergency Water Ingress
 *
 * Extends the base equipment calculator with storm-specific equipment
 * ratios derived from IICRC S500 Category 3 / storm-response guidelines.
 *
 * Key differences from standard jobs:
 *   - HEPA vacuums and large dehumidifiers are always included.
 *   - Equipment quantities scale with affected area (m²) and damage level.
 *   - Negative or non-finite area inputs are coerced to 0 (returns empty calc).
 *
 * All prices in AUD, inclusive of GST computation at 10%.
 */

import {
  calculateEquipment,
  EQUIPMENT_CATALOGUE,
  type EquipmentCalculation,
  type EquipmentRequest,
} from './equipment-calculator';

// ---------------------------------------------------------------------------
// Storm damage levels
// ---------------------------------------------------------------------------

export type StormDamageLevel = 'minor' | 'moderate' | 'severe';

/**
 * Multiplier applied to base equipment quantities for each damage level.
 * Severe storm damage demands significantly more drying and filtration capacity.
 */
const DAMAGE_MULTIPLIER: Record<StormDamageLevel, number> = {
  minor: 1,
  moderate: 1.5,
  severe: 2.5,
};

/**
 * Minimum rental duration (days) per damage level.
 * Storm jobs typically require multi-day drying cycles.
 */
const MIN_DAYS: Record<StormDamageLevel, number> = {
  minor: 3,
  moderate: 5,
  severe: 7,
};

// ---------------------------------------------------------------------------
// Storm equipment ratios (units per 20 m² of affected area)
// ---------------------------------------------------------------------------

/**
 * Base equipment ratios for a storm restoration job.
 * One unit of each item is added per `PER_AREA_M2` square metres.
 */
const PER_AREA_M2 = 20;

/** Minimum number of each item regardless of area. */
const STORM_MINIMUMS: Partial<Record<keyof typeof EQUIPMENT_CATALOGUE, number>> = {
  AIR_MOVER: 2,
  DEHUMIDIFIER_LARGE: 1, // Always at least 1 large dehumidifier on storm jobs
  HEPA_VACUUM: 1, // Always present — required for contaminated water remediation
  AIR_SCRUBBER: 1,
  MOISTURE_METER: 1,
  THERMAL_HYGROMETER: 1,
  CONTAINMENT_BARRIER: 1,
};

/** Scaling factors: how many units to add per PER_AREA_M2 m². */
const STORM_RATIOS: Partial<Record<keyof typeof EQUIPMENT_CATALOGUE, number>> = {
  AIR_MOVER: 1,
  DEHUMIDIFIER_LARGE: 0.5, // 1 large dehumidifier per 40 m²
  HEPA_VACUUM: 0.5, // 1 HEPA vacuum per 40 m²
  AIR_SCRUBBER: 0.5,
  MOISTURE_METER: 0,
  THERMAL_HYGROMETER: 0,
  CONTAINMENT_BARRIER: 0.25,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface StormEquipmentOptions {
  /** Affected floor area in square metres. Non-finite / negative → 0 (empty result). */
  areaM2: number;
  /** Damage classification per IICRC S500. Defaults to 'moderate'. */
  damageLevel?: StormDamageLevel;
  /**
   * Override rental duration in days.
   * If omitted, defaults to the minimum for the damage level.
   */
  days?: number;
}

/**
 * Calculate equipment requirements for a storm / Category 3 water ingress job.
 *
 * Key guarantees:
 *   - HEPA vacuum is always included (minimum 1 unit).
 *   - Large dehumidifier is always included (minimum 1 unit).
 *   - Zero-quantity items are excluded from output.
 *   - Negative area or quantity inputs return an empty calculation.
 *
 * @example
 * ```ts
 * // 80 m² severe storm damage:
 * const result = calculateStormEquipment({ areaM2: 80, damageLevel: 'severe' });
 * // → ~8 air movers, 4 large dehumidifiers, 4 HEPA vacuums, etc.
 * ```
 */
export function calculateStormEquipment(options: StormEquipmentOptions): EquipmentCalculation {
  const { damageLevel = 'moderate', days: overrideDays } = options;

  // Guard: coerce non-finite / negative area to 0
  const areaM2 = Number.isFinite(options.areaM2) && options.areaM2 > 0 ? options.areaM2 : 0;

  if (areaM2 === 0) {
    return { lineItems: [], subtotal: 0, gst: 0, total: 0, currency: 'AUD' };
  }

  const multiplier = DAMAGE_MULTIPLIER[damageLevel];
  const days = overrideDays != null && Number.isFinite(overrideDays) && overrideDays > 0
    ? Math.ceil(overrideDays)
    : MIN_DAYS[damageLevel];

  const areaUnits = areaM2 / PER_AREA_M2;

  const requests: EquipmentRequest[] = (
    Object.keys(STORM_MINIMUMS) as Array<keyof typeof EQUIPMENT_CATALOGUE>
  ).map((key) => {
    const minimum = STORM_MINIMUMS[key] ?? 0;
    const ratio = STORM_RATIOS[key] ?? 0;
    const rawQuantity = minimum + ratio * areaUnits;
    // Apply damage multiplier, then round up to whole units
    const quantity = Math.ceil(rawQuantity * multiplier);
    return { equipmentKey: key as string, quantity, days };
  });

  return calculateEquipment(requests);
}

/**
 * Describe a storm equipment package in plain English for quote notes.
 *
 * @example
 * ```ts
 * describeStormPackage(80, 'severe', 7)
 * // → "Severe storm restoration package for ~80 m² (7-day rental): ..."
 * ```
 */
export function describeStormPackage(
  areaM2: number,
  damageLevel: StormDamageLevel,
  days: number
): string {
  const level = damageLevel.charAt(0).toUpperCase() + damageLevel.slice(1);
  return (
    `${level} storm restoration package for ~${Math.round(areaM2)} m² (${days}-day rental). ` +
    'Includes HEPA vacuum and large-capacity dehumidification as per IICRC S500 guidelines.'
  );
}
