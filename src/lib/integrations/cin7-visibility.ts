/**
 * UNI-2259 groundwork: env-gated product visibility classification.
 *
 * Cin7 distinguishes "Secure Internal" from "Show Public" products, but the raw
 * field that carries this is not yet identified (Cin7ProductRow only has a
 * `[key: string]: unknown` catch-all). Rather than guess, the mapping is fully
 * env-driven and OFF by default:
 *
 *   CIN7_PRODUCT_VISIBILITY_FIELD          — raw Cin7 product field to read (enables the feature)
 *   CIN7_PRODUCT_VISIBILITY_SECURE_VALUES  — comma-separated values meaning Secure Internal
 *   CIN7_PRODUCT_VISIBILITY_PUBLIC_VALUES  — optional; values meaning Show Public. When unset,
 *                                            any non-empty value not in the secure list counts
 *                                            as Show Public (Cin7's split is binary).
 *
 * When enabled, the sync tallies per-visibility counts and surfaces them in the
 * sync response (`visibility_counts`) so Toby's 95 / 5,616 split can be
 * reconciled — no schema change, no import behaviour change. Persisting
 * visibility onto Product (migration) is the follow-up step tracked in UNI-2259.
 */

export type Cin7ProductVisibility = 'secure_internal' | 'show_public' | 'unknown';

export type Cin7VisibilityConfig = {
  /** Raw Cin7 product field name to read (e.g. a status/attribute field). */
  field: string;
  /** Normalized (trimmed, lowercased) values that mean Secure Internal. */
  secureValues: string[];
  /** Normalized values that mean Show Public; empty = "anything non-secure". */
  publicValues: string[];
};

export type Cin7VisibilityCounts = Record<Cin7ProductVisibility, number>;

function parseValueList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v.length > 0);
}

/** Returns null (feature off) unless CIN7_PRODUCT_VISIBILITY_FIELD is set. */
export function getCin7VisibilityConfig(): Cin7VisibilityConfig | null {
  const field = process.env.CIN7_PRODUCT_VISIBILITY_FIELD?.trim();
  if (!field) return null;
  return {
    field,
    secureValues: parseValueList(process.env.CIN7_PRODUCT_VISIBILITY_SECURE_VALUES),
    publicValues: parseValueList(process.env.CIN7_PRODUCT_VISIBILITY_PUBLIC_VALUES),
  };
}

/** Classify one raw Cin7 product row. Pure — config decides everything. */
export function classifyProductVisibility(
  row: Record<string, unknown>,
  config: Cin7VisibilityConfig
): Cin7ProductVisibility {
  // Own-property + primitive guards: a field name colliding with Object.prototype
  // members ('toString', 'constructor', …) or a non-scalar value (nested object,
  // array) must land in 'unknown', not silently inflate the public tally.
  if (!Object.hasOwn(row, config.field)) return 'unknown';
  const raw = row[config.field];
  if (raw != null && typeof raw !== 'string' && typeof raw !== 'number' && typeof raw !== 'boolean') {
    return 'unknown';
  }
  const value = raw == null ? '' : String(raw).trim().toLowerCase();
  if (!value) return 'unknown';
  if (config.secureValues.includes(value)) return 'secure_internal';
  if (config.publicValues.length > 0) {
    return config.publicValues.includes(value) ? 'show_public' : 'unknown';
  }
  // No explicit public list: Cin7's split is binary, so any non-secure value is public.
  return 'show_public';
}

/** Tally visibility across a page of raw Cin7 product rows. */
export function tallyProductVisibility(
  rows: Array<Record<string, unknown>>,
  config: Cin7VisibilityConfig
): Cin7VisibilityCounts {
  const counts: Cin7VisibilityCounts = { secure_internal: 0, show_public: 0, unknown: 0 };
  for (const row of rows) {
    counts[classifyProductVisibility(row, config)] += 1;
  }
  return counts;
}

/** Accumulate `add` into `into` (page-by-page aggregation in the sync route). */
export function addVisibilityCounts(
  into: Cin7VisibilityCounts,
  add: Cin7VisibilityCounts
): Cin7VisibilityCounts {
  into.secure_internal += add.secure_internal;
  into.show_public += add.show_public;
  into.unknown += add.unknown;
  return into;
}
