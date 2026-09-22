import type { Phase2Area } from '@/lib/phase2/types';

export type Phase2GateInput = {
  area: Phase2Area;
  phase1Missing: number;
  phase1ResidualSigned: boolean;
  stockCatalogComplete: boolean;
  priceListsComplete: boolean;
  previousAreaSigned: boolean;
  e2e3Ready: boolean;
  e5Cin7XeroAgree: boolean | null;
};

export type Phase2GateResult = {
  allowed: boolean;
  reason: string | null;
};

/**
 * v1.1 §4 / §10: each area starts only after its prerequisites.
 * A signed residual list may replace a zero Exception Report.
 */
export function evaluatePhase2Gates(input: Phase2GateInput): Phase2GateResult {
  if (input.area === 1) {
    if (input.phase1Missing > 0 && !input.phase1ResidualSigned) {
      return {
        allowed: false,
        reason:
          'Phase 1 master data is not closed. Area 1 waits on a zero Exception Report or a signed residual list.',
      };
    }
    if (!input.stockCatalogComplete) {
      return {
        allowed: false,
        reason: 'Inventory quantities are not complete. Area 1 cannot start on a partial Cin7 stock pull.',
      };
    }
    return { allowed: true, reason: null };
  }

  if (input.area === 2) {
    if (!input.previousAreaSigned) {
      return { allowed: false, reason: 'Area 2 starts only after Area 1 is signed off.' };
    }
    if (!input.e2e3Ready) {
      return {
        allowed: false,
        reason: 'E2 (non-AUD POs) and E3 (landed cost) must be confirmed before Area 2 can sign off.',
      };
    }
    return { allowed: true, reason: null };
  }

  if (input.area === 3) {
    if (!input.previousAreaSigned) {
      return { allowed: false, reason: 'Area 3 starts only after Area 2 is signed off.' };
    }
    if (!input.priceListsComplete) {
      return {
        allowed: false,
        reason: 'Price lists must be complete before Area 3. They are a prerequisite, not a parallel track.',
      };
    }
    return { allowed: true, reason: null };
  }

  if (input.area === 4) {
    if (!input.previousAreaSigned) {
      return { allowed: false, reason: 'Area 4 starts only after Area 3 is signed off.' };
    }
    return { allowed: true, reason: null };
  }

  if (input.area === 5) {
    if (!input.previousAreaSigned) {
      return { allowed: false, reason: 'Area 5 starts only after Area 4 is signed off.' };
    }
    return { allowed: true, reason: null };
  }

  if (input.area === 6) {
    if (!input.previousAreaSigned) {
      return {
        allowed: false,
        reason: 'Area 6 may investigate with Areas 2–4 but signs off only after Area 2.',
      };
    }
    return { allowed: true, reason: null };
  }

  if (input.area === 7) {
    if (!input.previousAreaSigned) {
      return {
        allowed: false,
        reason: 'Area 7 may investigate with Areas 2–4 but signs off only after Area 4.',
      };
    }
    return { allowed: true, reason: null };
  }

  if (input.e5Cin7XeroAgree === false) {
    return {
      allowed: false,
      reason: 'E5: Cin7 and Xero already disagree. That is bookkeeping, not an Optix Area 8 failure.',
    };
  }
  if (input.e5Cin7XeroAgree !== true) {
    return { allowed: false, reason: 'Area 8 waits on Areas 2 and 4 sign-off and a completed E5 check.' };
  }
  if (!input.previousAreaSigned) {
    return { allowed: false, reason: 'Area 8 starts only after Areas 2 and 4 are signed off.' };
  }
  return { allowed: true, reason: null };
}

export function previousAreaForSignOff(area: Phase2Area): Phase2Area | null {
  if (area === 1) return null;
  if (area === 6) return 2;
  if (area === 7) return 4;
  if (area === 8) return 4;
  return (area - 1) as Phase2Area;
}
