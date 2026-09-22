import {
  APPROVED_VARIANCE_CAP_AUD,
  APPROVED_VARIANCE_CAP_COUNT,
  type Phase2Variance,
} from '@/lib/phase2/types';

export type MaterialityTier = 'line' | 'warehouse' | 'company' | 'cogs_month' | 'ar_ap';

export type MaterialityPolicy = {
  quantity_exact: true;
  dollar_figures: 'tbc_with_toby';
  net_and_gross: true;
  tolerance_governs_signoff_only: true;
  approved_cap: { count: number; aud: number };
};

export const PHASE2_MATERIALITY: MaterialityPolicy = {
  quantity_exact: true,
  dollar_figures: 'tbc_with_toby',
  net_and_gross: true,
  tolerance_governs_signoff_only: true,
  approved_cap: {
    count: APPROVED_VARIANCE_CAP_COUNT,
    aud: APPROVED_VARIANCE_CAP_AUD,
  },
};

export function quantityWithinTolerance(cin7: number, optix: number): boolean {
  return cin7 === optix;
}

/** Both tests must pass. Dollar thresholds stay TBC, so any non-zero dollar gap fails sign-off. */
export function dollarWithinTolerance(input: {
  differences: number[];
  tier: MaterialityTier;
  netLimit: number | null;
  grossLimit: number | null;
}): boolean {
  const net = input.differences.reduce((s, n) => s + n, 0);
  const gross = input.differences.reduce((s, n) => s + Math.abs(n), 0);
  if (input.tier === 'ar_ap') {
    return net === 0 && gross === 0;
  }
  if (input.netLimit == null || input.grossLimit == null) {
    return net === 0 && gross === 0;
  }
  return Math.abs(net) <= input.netLimit && gross <= input.grossLimit;
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
