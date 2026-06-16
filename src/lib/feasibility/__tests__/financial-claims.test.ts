import { describe, expect, it } from 'vitest';
import {
  applyXeroBackingToCcwFinancialClaim,
  markCcwFinancialClaimStale,
  type CcwFinancialClaimDraft,
} from '../financial-claims';

describe('applyXeroBackingToCcwFinancialClaim', () => {
  it('backs owner-entered claims with Xero values', () => {
    const claim: CcwFinancialClaimDraft = {
      label: 'Seven Hills annual occupancy cost',
      value_aud: 165000,
      state: 'owner_entered',
      source_system: 'manual',
    };

    const result = applyXeroBackingToCcwFinancialClaim(claim, {
      value_aud: 164500.155,
      source_reference: 'xero:ProfitAndLoss:2026',
      confidence_score: 0.92,
    });

    expect(result.claim).toMatchObject({
      value_aud: 164500.16,
      state: 'xero_backed',
      source_system: 'xero',
      confidence_score: 0.92,
    });
    expect(result.xero_delta_aud).toBe(-499.84);
    expect(result.requires_owner_review).toBe(false);
  });

  it('does not silently overwrite Toby-adjusted claims when Xero disagrees', () => {
    const claim: CcwFinancialClaimDraft = {
      label: 'Artarmon expected incremental margin',
      value_aud: 75000,
      state: 'toby_adjusted',
      source_system: 'manual',
    };

    const result = applyXeroBackingToCcwFinancialClaim(claim, {
      value_aud: 52000,
      source_reference: 'xero:TrackingCategory:NSW',
    });

    expect(result.claim.value_aud).toBe(75000);
    expect(result.claim.state).toBe('disputed');
    expect(result.proposed_xero_value_aud).toBe(52000);
    expect(result.requires_owner_review).toBe(true);
  });

  it('allows an explicit owner-approved Xero overwrite', () => {
    const claim: CcwFinancialClaimDraft = {
      label: 'Parcel collection pilot sales uplift',
      value_aud: 10000,
      state: 'toby_adjusted',
      source_system: 'manual',
    };

    const result = applyXeroBackingToCcwFinancialClaim(
      claim,
      { value_aud: 12500, source_reference: 'xero:ManualJournal:pilot' },
      { allowXeroOverwrite: true }
    );

    expect(result.claim.value_aud).toBe(12500);
    expect(result.claim.state).toBe('xero_backed');
    expect(result.requires_owner_review).toBe(false);
  });
});

describe('markCcwFinancialClaimStale', () => {
  it('marks stale claims with an owner-visible reason', () => {
    const claim = markCcwFinancialClaimStale(
      {
        label: 'After-hours phone conversion',
        value_aud: 30000,
        state: 'xero_backed',
        source_system: 'xero',
      },
      'Xero backing is older than the accepted measurement window.'
    );

    expect(claim.state).toBe('stale');
    expect(claim.notes).toContain('older than');
  });
});
