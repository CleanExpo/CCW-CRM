import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { normaliseCcwOpportunityType, rankCcwOpportunity } from '@/lib/feasibility/opportunities';

type Params = { params: Promise<{ id: string }> };

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function numberOrNull(value: unknown) {
  const next = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(next) ? next : null;
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
    const title = text(body.title);
    if (!title) return NextResponse.json({ detail: 'title is required' }, { status: 400 });

    const opportunityType = normaliseCcwOpportunityType(body.opportunity_type ?? body.opportunityType);
    const ranking = rankCcwOpportunity({
      title,
      opportunity_type: opportunityType,
      expected_value_aud: numberOrNull(body.expected_value_aud),
      effort_score: numberOrNull(body.effort_score),
      risk_score: numberOrNull(body.risk_score),
      evidence_score: numberOrNull(body.evidence_score),
    });

    const row = await prisma.ccwGrowthOpportunity.create({
      data: {
        ownerUserId: scope.userId,
        statementId: id,
        title,
        opportunityType,
        status: text(body.status, 'candidate'),
        description: text(body.description) || null,
        decisionGate:
          text(body.decision_gate) ||
          'Toby approval required before spend, customer commitment, outbound campaign, or public claim.',
        expectedBenefit: {
          expected_value_aud: ranking.expected_value_aud,
          priority_score: ranking.priority_score,
          effort_score: ranking.effort_score,
          risk_score: ranking.risk_score,
          evidence_score: ranking.evidence_score,
        },
        measurements: {
          create: [
            {
              metricName: 'priority_score',
              metricValue: ranking.priority_score,
              unit: 'score_0_100',
              sourceSystem: text(body.source_system, 'manual'),
              sourcePayload: {
                expected_value_aud: ranking.expected_value_aud,
                effort_score: ranking.effort_score,
                risk_score: ranking.risk_score,
                evidence_score: ranking.evidence_score,
              },
            },
          ],
        },
      },
      include: { measurements: { orderBy: { measuredAt: 'desc' }, take: 5 } },
    });

    return NextResponse.json(
      {
        id: row.id,
        title: row.title,
        opportunity_type: row.opportunityType,
        status: row.status,
        description: row.description,
        expected_benefit: row.expectedBenefit,
        decision_gate: row.decisionGate,
        measurements: row.measurements.map((measurement) => ({
          id: measurement.id,
          metric_name: measurement.metricName,
          metric_value: measurement.metricValue,
          unit: measurement.unit,
          source_system: measurement.sourceSystem,
          measured_at: measurement.measuredAt.toISOString(),
        })),
      },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
