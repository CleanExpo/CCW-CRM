import { describe, expect, it } from 'vitest';
import { calculateCcwScenarioFeasibility } from '../ccw-scenario-scoring';

const SEVEN_HILLS_BASELINE_AUD = 165_000;

describe('calculateCcwScenarioFeasibility', () => {
  it('keeps Seven Hills attractive when it matches the known low-cost baseline', () => {
    const result = calculateCcwScenarioFeasibility({
      scenarioCode: 'seven_hills_optimised',
      scenarioName: 'Seven Hills optimised',
      annualRentAud: 60_000,
      annualStaffCostAud: 105_000,
      baselineAnnualCostAud: SEVEN_HILLS_BASELINE_AUD,
      strategicScore: 70,
      riskScore: 20,
    });

    expect(result.total_annual_cost_aud).toBe(SEVEN_HILLS_BASELINE_AUD);
    expect(result.required_extra_monthly_contribution_aud).toBe(0);
    expect(result.recommendation).toBe('keep');
  });

  it('does not recommend Artarmon until incremental contribution margin covers the extra cost', () => {
    const result = calculateCcwScenarioFeasibility({
      scenarioCode: 'artarmon_micro_showroom',
      scenarioName: 'Artarmon micro-showroom',
      annualRentAud: 90_000,
      annualStaffCostAud: 105_000,
      annualOutgoingsAud: 15_000,
      oneOffFitoutAud: 35_000,
      oneOffRelocationAud: 20_000,
      expectedIncrementalMarginAud: 30_000,
      baselineAnnualCostAud: SEVEN_HILLS_BASELINE_AUD,
      strategicScore: 75,
      riskScore: 50,
    });

    expect(result.incremental_first_year_cost_vs_baseline_aud).toBe(100_000);
    expect(result.required_extra_monthly_contribution_aud).toBe(8333.33);
    expect(result.margin_buffer_aud).toBe(-70_000);
    expect(result.recommendation).not.toBe('pilot');
  });

  it('can pilot the hybrid AI phone and parcel collection model when low-cost upside is proven', () => {
    const result = calculateCcwScenarioFeasibility({
      scenarioCode: 'hybrid_ai_phone_agent',
      scenarioName: 'Seven Hills + parcel collection + AI phone agent',
      annualRentAud: 60_000,
      annualStaffCostAud: 105_000,
      annualOutgoingsAud: 5_000,
      oneOffFitoutAud: 10_000,
      expectedIncrementalMarginAud: 30_000,
      baselineAnnualCostAud: SEVEN_HILLS_BASELINE_AUD,
      strategicScore: 90,
      riskScore: 35,
    });

    expect(result.incremental_first_year_cost_vs_baseline_aud).toBe(15_000);
    expect(result.margin_buffer_aud).toBe(15_000);
    expect(result.weighted_feasibility_score).toBeGreaterThanOrEqual(70);
    expect(result.recommendation).toBe('pilot');
  });
});
