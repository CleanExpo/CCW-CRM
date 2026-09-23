import {
  APPROVED_VARIANCE_CAP_AUD,
  APPROVED_VARIANCE_CAP_COUNT,
  type Phase2Variance,
} from '@/lib/phase2/types';

export type MaterialityTier = 'line' | 'warehouse' | 'company' | 'cogs_month' | 'ar_ap';

export type MaterialityPolicy = {
  quantity_exact: true;
  source: 'schedule_a_rev1_2026-09-23';
  net_and_gross: true;
  tolerance_governs_signoff_only: true;
  approved_cap: { count: number; aud: number };
  tiers: Record<
    MaterialityTier,
    { net: number | 'greater_of'; gross: number | 'greater_of'; note: string }
  >;
};

export const PHASE2_MATERIALITY: MaterialityPolicy = {
  quantity_exact: true,
  source: 'schedule_a_rev1_2026-09-23',
  net_and_gross: true,
  tolerance_governs_signoff_only: true,
  approved_cap: {
    count: APPROVED_VARIANCE_CAP_COUNT,
    aud: APPROVED_VARIANCE_CAP_AUD,
  },
  tiers: {
    line: { net: 0.01, gross: 0.01, note: 'Per invoice line / per SKU per warehouse' },
    warehouse: { net: 1, gross: 50, note: 'Per warehouse inventory value' },
    company: {
      net: 'greater_of',
      gross: 'greater_of',
      note: 'Company-wide: greater of $50 or 0.01% net; greater of $500 or 0.1% gross',
    },
    cogs_month: {
      net: 'greater_of',
      gross: 'greater_of',
      note: 'COGS per month: greater of $100 or 0.05% net; greater of $1,000 or 0.5% gross',
    },
    ar_ap: { net: 0, gross: 0, note: 'AR/AP control totals tie exactly' },
  },
};

export function quantityWithinTolerance(cin7: number, optix: number): boolean {
  return cin7 === optix;
}

function greaterOf(floor: number, percent: number, base: number): number {
  return Math.max(floor, Math.abs(base) * percent);
}

export function limitsForTier(input: {
  tier: MaterialityTier;
  base?: number;
}): { netLimit: number; grossLimit: number } {
  const base = input.base ?? 0;
  if (input.tier === 'line') return { netLimit: 0.01, grossLimit: 0.01 };
  if (input.tier === 'warehouse') return { netLimit: 1, grossLimit: 50 };
  if (input.tier === 'company') {
    return {
      netLimit: greaterOf(50, 0.0001, base),
      grossLimit: greaterOf(500, 0.001, base),
    };
  }
  if (input.tier === 'cogs_month') {
    return {
      netLimit: greaterOf(100, 0.0005, base),
      grossLimit: greaterOf(1000, 0.005, base),
    };
  }
  return { netLimit: 0, grossLimit: 0 };
}

/** Both net and gross must pass so a +X / −X pair cannot hide. */
export function dollarWithinTolerance(input: {
  differences: number[];
  tier: MaterialityTier;
  base?: number;
  netLimit?: number | null;
  grossLimit?: number | null;
}): boolean {
  const net = input.differences.reduce((s, n) => s + n, 0);
  const gross = input.differences.reduce((s, n) => s + Math.abs(n), 0);
  const limits =
    input.netLimit != null && input.grossLimit != null
      ? { netLimit: input.netLimit, grossLimit: input.grossLimit }
      : limitsForTier({ tier: input.tier, base: input.base });
  if (input.tier === 'ar_ap') {
    return net === 0 && gross === 0;
  }
  return Math.abs(net) <= limits.netLimit && gross <= limits.grossLimit;
}

export function approvedVarianceCapExceeded(approved: Phase2Variance[]): {
  exceeded: boolean;
  reason: string | null;
} {
  const count = approved.length;
  const aud = approved.reduce((s, v) => s + Math.abs(v.difference), 0);
  if (count > APPROVED_VARIANCE_CAP_COUNT) {
    return {
      exceeded: true,
      reason: `Approved variance cap is ${APPROVED_VARIANCE_CAP_COUNT} items; ${count} would close this area.`,
    };
  }
  if (aud > APPROVED_VARIANCE_CAP_AUD) {
    return {
      exceeded: true,
      reason: `Approved variance cap is $${APPROVED_VARIANCE_CAP_AUD}; $${aud} would close this area.`,
    };
  }
  return { exceeded: false, reason: null };
}
