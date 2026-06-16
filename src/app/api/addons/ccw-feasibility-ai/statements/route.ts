import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { resolveCcwWorkspaceContext } from '@/lib/auth/ccw-workspace-context';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import {
  findingsPayloadFromMarkdown,
  normaliseCcwFeasibilityStatementSeed,
} from '@/lib/feasibility/statement-read-path';
import type { Prisma } from '@prisma/client';

function statementListItem(row: Prisma.CcwFeasibilityStatementGetPayload<{
  include: {
    parentStatement: { select: { id: true; title: true } };
    _count: { select: { childStatements: true; scenarios: true; findings: true; financialClaims: true; opportunities: true } };
  };
}>) {
  return {
    id: row.id,
    title: row.title,
    objective: row.objective,
    status: row.status,
    parent_statement_id: row.parentStatementId,
    parent_title: row.parentStatement?.title ?? null,
    generated_by: row.generatedBy,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    approved_at: row.approvedAt?.toISOString() ?? null,
    counts: {
      children: row._count.childStatements,
      scenarios: row._count.scenarios,
      findings: row._count.findings,
      financial_claims: row._count.financialClaims,
      opportunities: row._count.opportunities,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('page_size') || '25', 10)));
    const status = searchParams.get('status')?.trim();
    const search = searchParams.get('search')?.trim();

    const where: Prisma.CcwFeasibilityStatementWhereInput = {
      ownerUserId: { in: workspaceUserIds },
    };
    if (status && status !== 'all') where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { objective: { contains: search, mode: 'insensitive' } },
        { contentMarkdown: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.ccwFeasibilityStatement.findMany({
        where,
        include: {
          parentStatement: { select: { id: true, title: true } },
          _count: {
            select: {
              childStatements: true,
              scenarios: true,
              findings: true,
              financialClaims: true,
              opportunities: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.ccwFeasibilityStatement.count({ where }),
    ]);

    return NextResponse.json({
      items: rows.map(statementListItem),
      total,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(total / pageSize) || 1,
    });
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const ctx = await resolveCcwWorkspaceContext(scope.userId);
    if (!ctx) return NextResponse.json({ detail: 'No workspace found for this user' }, { status: 403 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const seed = normaliseCcwFeasibilityStatementSeed(body);

    if (seed.parent_statement_id) {
      const parent = await prisma.ccwFeasibilityStatement.findFirst({
        where: { id: seed.parent_statement_id, ownerUserId: { in: ctx.workspaceUserIds } },
        select: { id: true },
      });
      if (!parent) return NextResponse.json({ detail: 'Parent statement not found' }, { status: 404 });
    }

    const evidence = findingsPayloadFromMarkdown(seed.content_markdown ?? '');

    const row = await prisma.ccwFeasibilityStatement.create({
      data: {
        ownerUserId: scope.userId,
        parentStatementId: seed.parent_statement_id,
        title: seed.title,
        objective: seed.objective,
        status: 'draft',
        contentMarkdown: seed.content_markdown,
        evidenceSummary: evidence.summary,
        findings: {
          create: evidence.findings.map((finding) => ({
            ownerUserId: scope.userId,
            findingType: finding.finding_type,
            tag: finding.tag,
            claim: finding.claim,
            sourceLabel: finding.source_label,
            sourceUrl: finding.source_url,
            sourcePath: finding.source_path,
            reviewRequired: finding.review_required,
          })),
        },
      },
      include: {
        parentStatement: { select: { id: true, title: true } },
        _count: {
          select: {
            childStatements: true,
            scenarios: true,
            findings: true,
            financialClaims: true,
            opportunities: true,
          },
        },
      },
    });

    return NextResponse.json(statementListItem(row), { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
