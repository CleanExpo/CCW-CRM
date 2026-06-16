import { describe, expect, it } from 'vitest';
import { normaliseCcwOpportunityType, rankCcwOpportunity } from '../opportunities';

describe('rankCcwOpportunity', () => {
  it('prioritises high-value evidenced opportunities over unsupported ideas', () => {
    const backed = rankCcwOpportunity({
      title: 'After-hours phone lead capture',
      opportunity_type: 'growth',
      expected_value_aud: 85_000,
      effort_score: 35,
      risk_score: 25,
      evidence_score: 80,
    });
    const unsupported = rankCcwOpportunity({
      title: 'Unverified new branch',
      opportunity_type: 'diversification',
      expected_value_aud: 8_000,
      effort_score: 90,
      risk_score: 85,
      evidence_score: 10,
    });

    expect(backed.priority_score).toBeGreaterThan(unsupported.priority_score);
    expect(backed.expected_value_aud).toBe(85_000);
  });

  it('normalises score and money inputs into bounded planning values', () => {
    const ranking = rankCcwOpportunity({
      title: 'Cost saving pass',
      opportunity_type: 'cost_saving',
      expected_value_aud: 12_345.678,
      effort_score: -20,
      risk_score: 130,
      evidence_score: 101,
    });

    expect(ranking.expected_value_aud).toBe(12_345.68);
    expect(ranking.effort_score).toBe(0);
    expect(ranking.risk_score).toBe(100);
    expect(ranking.evidence_score).toBe(100);
  });
});

describe('normaliseCcwOpportunityType', () => {
  it('keeps known Toby opportunity categories and defaults to growth', () => {
    expect(normaliseCcwOpportunityType('diversification')).toBe('diversification');
    expect(normaliseCcwOpportunityType('cost_saving')).toBe('cost_saving');
    expect(normaliseCcwOpportunityType('risk_reduction')).toBe('risk_reduction');
    expect(normaliseCcwOpportunityType('unknown')).toBe('growth');
  });
});
