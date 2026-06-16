export type CcwFeasibilityRecommendation = 'keep' | 'pilot' | 'defer' | 'reject';

export type CcwFeasibilityScenarioInput = {
  scenarioCode: string;
  scenarioName: string;
  annualRentAud?: number | null;
  annualStaffCostAud?: number | null;
  annualOutgoingsAud?: number | null;
  oneOffFitoutAud?: number | null;
  oneOffRelocationAud?: number | null;
  expectedIncrementalMarginAud?: number | null;
  baselineAnnualCostAud?: number | null;
  strategicScore?: number | null;
  riskScore?: number | null;
  costScore?: number | null;
};

export type CcwFeasibilityScoreBreakdown = {
  strategic_score: number;
  cost_score: number;
  risk_inverse_score: number;
  margin_score: number;
};

export type CcwFeasibilityScenarioResult = {
  scenario_code: string;
  scenario_name: string;
  total_annual_cost_aud: number;
  estimated_first_year_cost_aud: number;
  incremental_first_year_cost_vs_baseline_aud: number;
  required_extra_monthly_contribution_aud: number;
  expected_incremental_margin_aud: number;
  margin_buffer_aud: number;
  weighted_feasibility_score: number;
  recommendation: CcwFeasibilityRecommendation;
  score_breakdown: CcwFeasibilityScoreBreakdown;
};

const DEFAULT_WEIGHTS = {
  strategic: 0.35,
  cost: 0.25,
  risk: 0.25,
  margin: 0.15,
} as const;

function finiteMoney(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

export function clampCcwFeasibilityScore(
  value: number | null | undefined,
  fallback: number
): number {
  const next = Number.isFinite(value) ? Number(value) : fallback;
  return Math.max(0, Math.min(100, Math.round(next)));
}

function deriveCostScore(incrementalFirstYearCostAud: number): number {
  if (incrementalFirstYearCostAud <= 0) return 95;
  if (incrementalFirstYearCostAud <= 15_000) return 85;
  if (incrementalFirstYearCostAud <= 30_000) return 72;
  if (incrementalFirstYearCostAud <= 60_000) return 55;
  if (incrementalFirstYearCostAud <= 100_000) return 35;
  return 20;
}

function deriveMarginScore(expectedMarginAud: number, requiredExtraAnnualContributionAud: number): number {
  if (requiredExtraAnnualContributionAud <= 0) {
    return expectedMarginAud > 0 ? 95 : 70;
  }

  const coverRatio = expectedMarginAud / requiredExtraAnnualContributionAud;
  if (coverRatio >= 1.5) return 95;
  if (coverRatio >= 1) return 85;
  if (coverRatio >= 0.75) return 65;
  if (coverRatio >= 0.5) return 45;
  return 25;
}

function chooseRecommendation(
  scenarioCode: string,
  weightedScore: number,
  marginBufferAud: number,
  incrementalFirstYearCostAud: number
): CcwFeasibilityRecommendation {
  const code = scenarioCode.toLowerCase();

  if (code.includes('seven_hills') && incrementalFirstYearCostAud <= 0 && weightedScore >= 55) {
    return 'keep';
  }

  if (weightedScore >= 70 && marginBufferAud >= 0) {
    return 'pilot';
  }

  if (weightedScore >= 55) {
    return 'defer';
  }

  return 'reject';
}

export function calculateCcwScenarioFeasibility(
  input: CcwFeasibilityScenarioInput
): CcwFeasibilityScenarioResult {
  const annualRentAud = finiteMoney(input.annualRentAud);
  const annualStaffCostAud = finiteMoney(input.annualStaffCostAud);
  const annualOutgoingsAud = finiteMoney(input.annualOutgoingsAud);
  const oneOffFitoutAud = finiteMoney(input.oneOffFitoutAud);
  const oneOffRelocationAud = finiteMoney(input.oneOffRelocationAud);
  const baselineAnnualCostAud = finiteMoney(input.baselineAnnualCostAud);
  const expectedIncrementalMarginAud = finiteMoney(input.expectedIncrementalMarginAud);

  const totalAnnualCostAud = annualRentAud + annualStaffCostAud + annualOutgoingsAud;
  const estimatedFirstYearCostAud = totalAnnualCostAud + oneOffFitoutAud + oneOffRelocationAud;
  const incrementalFirstYearCostAud = Math.max(0, estimatedFirstYearCostAud - baselineAnnualCostAud);
  const requiredExtraMonthlyContributionAud = incrementalFirstYearCostAud / 12;
  const marginBufferAud = expectedIncrementalMarginAud - incrementalFirstYearCostAud;

  const strategicScore = clampCcwFeasibilityScore(input.strategicScore, 50);
  const costScore = clampCcwFeasibilityScore(input.costScore, deriveCostScore(incrementalFirstYearCostAud));
  const riskInverseScore = 100 - clampCcwFeasibilityScore(input.riskScore, 50);
  const marginScore = deriveMarginScore(expectedIncrementalMarginAud, incrementalFirstYearCostAud);

  const weightedScore =
    strategicScore * DEFAULT_WEIGHTS.strategic +
    costScore * DEFAULT_WEIGHTS.cost +
    riskInverseScore * DEFAULT_WEIGHTS.risk +
    marginScore * DEFAULT_WEIGHTS.margin;

  return {
    scenario_code: input.scenarioCode,
    scenario_name: input.scenarioName,
    total_annual_cost_aud: money(totalAnnualCostAud),
    estimated_first_year_cost_aud: money(estimatedFirstYearCostAud),
    incremental_first_year_cost_vs_baseline_aud: money(incrementalFirstYearCostAud),
    required_extra_monthly_contribution_aud: money(requiredExtraMonthlyContributionAud),
    expected_incremental_margin_aud: money(expectedIncrementalMarginAud),
    margin_buffer_aud: money(marginBufferAud),
    weighted_feasibility_score: money(weightedScore),
    recommendation: chooseRecommendation(
      input.scenarioCode,
      weightedScore,
      marginBufferAud,
      incrementalFirstYearCostAud
    ),
    score_breakdown: {
      strategic_score: strategicScore,
      cost_score: costScore,
      risk_inverse_score: riskInverseScore,
      margin_score: marginScore,
    },
  };
}
