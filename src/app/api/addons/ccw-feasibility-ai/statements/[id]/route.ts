import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { findingsPayloadFromMarkdown } from '@/lib/feasibility/statement-read-path';
import type { Prisma } from '@prisma/client';

type Params = { params: Promise<{ id: string }> };

const DETAIL_INCLUDE = {
  parentStatement: { select: { id: true, title: true, createdAt: true } },
  childStatements: {
    select: { id: true, title: true, status: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: 'desc' },
  },
  scenarios: { orderBy: { createdAt: 'desc' } },
  financialClaims: {
    include: { evidence: { orderBy: { capturedAt: 'desc' }, take: 5 } },
    orderBy: { updatedAt: 'desc' },
  },
  findings: { orderBy: [{ reviewRequired: 'desc' }, { createdAt: 'desc' }] },
  opportunities: { include: { measurements: { orderBy: { measuredAt: 'desc' }, take: 5 } }, orderBy: { updatedAt: 'desc' } },
} satisfies Prisma.CcwFeasibilityStatementInclude;

type StatementDetailRow = Prisma.CcwFeasibilityStatementGetPayload<{ include: typeof DETAIL_INCLUDE }>;

function toIso(date: Date | null | undefined) {
  return date ? date.toISOString() : null;
}

function statementDetail(row: StatementDetailRow) {
  return {
    id: row.id,
    title: row.title,
    objective: row.objective,
    status: row.status,
    content_markdown: row.contentMarkdown,
    evidence_summary: row.evidenceSummary,
    generated_by: row.generatedBy,
    approved_by: row.approvedBy,
    approved_at: toIso(row.approvedAt),
    parent_statement_id: row.parentStatementId,
    parent: row.parentStatement
      ? {
          id: row.parentStatement.id,
          title: row.parentStatement.title,
          created_at: row.parentStatement.createdAt.toISOString(),
        }
      : null,
    children: row.childStatements.map((child) => ({
      id: child.id,
      title: child.title,
      status: child.status,
      created_at: child.createdAt.toISOString(),
      updated_at: child.updatedAt.toISOString(),
    })),
    scenarios: row.scenarios.map((scenario) => ({
      id: scenario.id,
      scenario_code: scenario.scenarioCode,
      scenario_name: scenario.scenarioName,
      status: scenario.status,
      recommendation: scenario.recommendation,
      weighted_feasibility_score: scenario.weightedFeasibilityScore,
      required_extra_monthly_contribution_aud: scenario.requiredExtraMonthlyContributionAud,
      parent_scenario_id: scenario.parentScenarioId,
      updated_at: scenario.updatedAt.toISOString(),
    })),
    financial_claims: row.financialClaims.map((claim) => ({
      id: claim.id,
      claim_type: claim.claimType,
      label: claim.label,
      value_aud: claim.valueAud,
      state: claim.state,
      source_system: claim.sourceSystem,
      xero_account_code: claim.xeroAccountCode,
      backed_at: toIso(claim.backedAt),
      evidence: claim.evidence.map((evidence) => ({
        id: evidence.id,
        evidence_type: evidence.evidenceType,
        source_system: evidence.sourceSystem,
        source_reference: evidence.sourceReference,
        amount_aud: evidence.amountAud,
        captured_at: evidence.capturedAt.toISOString(),
      })),
    })),
    findings: row.findings.map((finding) => ({
      id: finding.id,
      finding_type: finding.findingType,
      tag: finding.tag,
      claim: finding.claim,
      source_label: finding.sourceLabel,
      source_url: finding.sourceUrl,
      source_path: finding.sourcePath,
      status: finding.status,
      review_required: finding.reviewRequired,
      created_at: finding.createdAt.toISOString(),
    })),
    opportunities: row.opportunities.map((opportunity) => ({
      id: opportunity.id,
      title: opportunity.title,
      opportunity_type: opportunity.opportunityType,
      status: opportunity.status,
      description: opportunity.description,
      expected_benefit: opportunity.expectedBenefit,
      decision_gate: opportunity.decisionGate,
      measurements: opportunity.measurements.map((measurement) => ({
        id: measurement.id,
        metric_name: measurement.metricName,
        metric_value: measurement.metricValue,
        unit: measurement.unit,
        source_system: measurement.sourceSystem,
        measured_at: measurement.measuredAt.toISOString(),
      })),
    })),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

async function loadStatement(id: string, ownerUserIds: string[]) {
  return prisma.ccwFeasibilityStatement.findFirst({
    where: { id, ownerUserId: { in: ownerUserIds } },
    include: DETAIL_INCLUDE,
  });
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const row = await loadStatement(id, workspaceUserIds);
    if (!row) return NextResponse.json({ detail: 'Statement not found' }, { status: 404 });

    return NextResponse.json(statementDetail(row));
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const existing = await prisma.ccwFeasibilityStatement.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds } },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ detail: 'Statement not found' }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : undefined;
    const objective =
      typeof body.objective === 'string' && body.objective.trim() ? body.objective.trim() : undefined;
    const status = typeof body.status === 'string' && body.status.trim() ? body.status.trim() : undefined;
    const contentMarkdown =
      typeof body.content_markdown === 'string'
        ? body.content_markdown
        : typeof body.contentMarkdown === 'string'
          ? body.contentMarkdown
          : undefined;

    const evidence = contentMarkdown !== undefined ? findingsPayloadFromMarkdown(contentMarkdown) : null;

    await prisma.$transaction(async (tx) => {
      await tx.ccwFeasibilityStatement.update({
        where: { id },
        data: {
          title,
          objective,
          status,
          contentMarkdown,
          evidenceSummary: evidence?.summary,
        },
      });

      if (evidence) {
        await tx.ccwEvidenceFinding.deleteMany({ where: { statementId: id } });
        if (evidence.findings.length > 0) {
          await tx.ccwEvidenceFinding.createMany({
            data: evidence.findings.map((finding) => ({
              ownerUserId: scope.userId,
              statementId: id,
              findingType: finding.finding_type,
              tag: finding.tag,
              claim: finding.claim,
              sourceLabel: finding.source_label,
              sourceUrl: finding.source_url,
              sourcePath: finding.source_path,
              reviewRequired: finding.review_required,
            })),
          });
        }
      }
    });

    const row = await loadStatement(id, workspaceUserIds);
    if (!row) return NextResponse.json({ detail: 'Statement not found after update' }, { status: 404 });
    return NextResponse.json(statementDetail(row));
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
