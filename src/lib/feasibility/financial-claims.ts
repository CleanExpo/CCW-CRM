export type CcwFinancialClaimState =
  | 'owner_entered'
  | 'toby_adjusted'
  | 'xero_backed'
  | 'stale'
  | 'disputed';

export type CcwFinancialClaimDraft = {
  label: string;
  value_aud: number | null;
  state: CcwFinancialClaimState;
  source_system: 'manual' | 'xero' | 'system';
  confidence_score?: number | null;
  notes?: string | null;
};

export type CcwXeroBacking = {
  value_aud: number;
  source_reference: string;
  confidence_score?: number | null;
};

export type CcwFinancialClaimMergeResult = {
  claim: CcwFinancialClaimDraft;
  xero_delta_aud: number | null;
  requires_owner_review: boolean;
  proposed_xero_value_aud: number | null;
};

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function isMeaningfullyDifferent(current: number | null, incoming: number): boolean {
  if (current === null || !Number.isFinite(current)) return true;
  return Math.abs(current - incoming) >= 0.01;
}

export function applyXeroBackingToCcwFinancialClaim(
  claim: CcwFinancialClaimDraft,
  backing: CcwXeroBacking,
  options: { allowXeroOverwrite?: boolean } = {}
): CcwFinancialClaimMergeResult {
  const incomingValue = money(backing.value_aud);
  const currentValue = claim.value_aud === null ? null : money(claim.value_aud);
  const xeroDeltaAud = currentValue === null ? null : money(incomingValue - currentValue);
  const confidenceScore = backing.confidence_score ?? claim.confidence_score ?? null;

  if (claim.state === 'toby_adjusted' && !options.allowXeroOverwrite) {
    return {
      claim: {
        ...claim,
        state: isMeaningfullyDifferent(currentValue, incomingValue) ? 'disputed' : 'xero_backed',
        confidence_score: confidenceScore,
        notes:
          isMeaningfullyDifferent(currentValue, incomingValue)
            ? `Xero proposes AUD ${incomingValue} from ${backing.source_reference}; Toby-adjusted value retained.`
            : claim.notes ?? null,
      },
      xero_delta_aud: xeroDeltaAud,
      requires_owner_review: isMeaningfullyDifferent(currentValue, incomingValue),
      proposed_xero_value_aud: isMeaningfullyDifferent(currentValue, incomingValue) ? incomingValue : null,
    };
  }

  return {
    claim: {
      ...claim,
      value_aud: incomingValue,
      state: 'xero_backed',
      source_system: 'xero',
      confidence_score: confidenceScore,
      notes: claim.notes ?? `Backed by Xero source ${backing.source_reference}.`,
    },
    xero_delta_aud: xeroDeltaAud,
    requires_owner_review: false,
    proposed_xero_value_aud: null,
  };
}

export function markCcwFinancialClaimStale(
  claim: CcwFinancialClaimDraft,
  reason: string
): CcwFinancialClaimDraft {
  return {
    ...claim,
    state: 'stale',
    notes: reason,
  };
}
