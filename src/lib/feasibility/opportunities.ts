export type CcwOpportunityType = 'growth' | 'diversification' | 'cost_saving' | 'risk_reduction';

export type CcwOpportunityInput = {
  title: string;
  opportunity_type: CcwOpportunityType;
  expected_value_aud?: number | null;
  effort_score?: number | null;
  risk_score?: number | null;
  evidence_score?: number | null;
};

export type CcwOpportunityRanking = {
  priority_score: number;
  expected_value_aud: number;
  effort_score: number;
  risk_score: number;
  evidence_score: number;
};

function score(value: number | null | undefined, fallback: number): number {
  const next = Number.isFinite(value) ? Number(value) : fallback;
  return Math.max(0, Math.min(100, Math.round(next)));
}

function money(value: number | null | undefined): number {
  return Number.isFinite(value) ? Math.round(Number(value) * 100) / 100 : 0;
}

function valueScore(expectedValueAud: number): number {
  if (expectedValueAud >= 100_000) return 100;
  if (expectedValueAud >= 50_000) return 85;
  if (expectedValueAud >= 25_000) return 70;
  if (expectedValueAud >= 10_000) return 55;
  if (expectedValueAud > 0) return 35;
  return 10;
}

export function rankCcwOpportunity(input: CcwOpportunityInput): CcwOpportunityRanking {
  const expectedValueAud = money(input.expected_value_aud);
  const effortScore = score(input.effort_score, 50);
  const riskScore = score(input.risk_score, 50);
  const evidenceScore = score(input.evidence_score, 35);

  const priority =
    valueScore(expectedValueAud) * 0.4 +
    (100 - effortScore) * 0.2 +
    (100 - riskScore) * 0.2 +
    evidenceScore * 0.2;

  return {
    priority_score: Math.round(priority * 100) / 100,
    expected_value_aud: expectedValueAud,
    effort_score: effortScore,
    risk_score: riskScore,
    evidence_score: evidenceScore,
  };
}

export function normaliseCcwOpportunityType(value: unknown): CcwOpportunityType {
  if (value === 'diversification') return 'diversification';
  if (value === 'cost_saving') return 'cost_saving';
  if (value === 'risk_reduction') return 'risk_reduction';
  return 'growth';
}
