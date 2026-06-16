import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { calculateCcwScenarioFeasibility } from '@/lib/feasibility/ccw-scenario-scoring';

type Params = { params: Promise<{ id: string }> };

function finiteNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function scenarioCode(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80) || `scenario_${Date.now()}`
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const statement = await prisma.ccwFeasibilityStatement.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds } },
      select: { id: true },
    });
    if (!statement) return NextResponse.json({ detail: 'Statement not found' }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const scenarioName =
      typeof body.scenario_name === 'string' && body.scenario_name.trim()
        ? body.scenario_name.trim()
        : 'Seven Hills + AI phone pilot';
    const code =
      typeof body.scenario_code === 'string' && body.scenario_code.trim()
        ? scenarioCode(body.scenario_code)
        : scenarioCode(scenarioName);

    const annualRentAud = finiteNumber(body.annual_rent_aud);
    const annualStaffCostAud = finiteNumber(body.annual_staff_cost_aud);
    const annualOutgoingsAud = finiteNumber(body.annual_outgoings_aud);
    const oneOffFitoutAud = finiteNumber(body.one_off_fitout_aud);
    const oneOffRelocationAud = finiteNumber(body.one_off_relocation_aud);
    const expectedIncrementalMarginAud = finiteNumber(body.expected_incremental_margin_aud);
    const baselineAnnualCostAud = finiteNumber(body.baseline_annual_cost_aud);

    const score = calculateCcwScenarioFeasibility({
      scenarioCode: code,
      scenarioName,
      annualRentAud,
      annualStaffCostAud,
      annualOutgoingsAud,
      oneOffFitoutAud,
      oneOffRelocationAud,
      expectedIncrementalMarginAud,
      baselineAnnualCostAud,
      strategicScore: finiteNumber(body.strategic_score),
      riskScore: finiteNumber(body.risk_score),
      costScore: finiteNumber(body.cost_score),
    });

    const row = await prisma.ccwFeasibilityScenario.upsert({
      where: { statementId_scenarioCode: { statementId: id, scenarioCode: code } },
      create: {
        ownerUserId: scope.userId,
        statementId: id,
        scenarioCode: code,
        scenarioName,
        annualRentAud,
        annualStaffCostAud,
        annualOutgoingsAud,
        oneOffFitoutAud,
        oneOffRelocationAud,
        expectedIncrementalMarginAud,
        baselineAnnualCostAud,
        requiredExtraMonthlyContributionAud: score.required_extra_monthly_contribution_aud,
        weightedFeasibilityScore: score.weighted_feasibility_score,
        recommendation: score.recommendation,
        scoreBreakdown: score.score_breakdown,
      },
      update: {
        scenarioName,
        annualRentAud,
        annualStaffCostAud,
        annualOutgoingsAud,
        oneOffFitoutAud,
        oneOffRelocationAud,
        expectedIncrementalMarginAud,
        baselineAnnualCostAud,
        requiredExtraMonthlyContributionAud: score.required_extra_monthly_contribution_aud,
        weightedFeasibilityScore: score.weighted_feasibility_score,
        recommendation: score.recommendation,
        scoreBreakdown: score.score_breakdown,
      },
    });

    return NextResponse.json(
      {
        id: row.id,
        scenario_code: row.scenarioCode,
        scenario_name: row.scenarioName,
        recommendation: row.recommendation,
        weighted_feasibility_score: row.weightedFeasibilityScore,
        required_extra_monthly_contribution_aud: row.requiredExtraMonthlyContributionAud,
        updated_at: row.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
