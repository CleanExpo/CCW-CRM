import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { buildCcwFeasibilityMarkdownExport } from '@/lib/feasibility/statement-read-path';

type Params = { params: Promise<{ id: string }> };

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'ccw-feasibility-statement';
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const row = await prisma.ccwFeasibilityStatement.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds } },
      include: { findings: { orderBy: [{ reviewRequired: 'desc' }, { createdAt: 'desc' }] } },
    });
    if (!row) return NextResponse.json({ detail: 'Statement not found' }, { status: 404 });

    const markdown = buildCcwFeasibilityMarkdownExport({
      id: row.id,
      title: row.title,
      objective: row.objective,
      status: row.status,
      content_markdown: row.contentMarkdown,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
      parent_statement_id: row.parentStatementId,
      findings: row.findings.map((finding) => ({
        finding_type: finding.findingType === 'assumption' ? 'assumption' : 'claim',
        tag:
          finding.tag === 'verified'
            ? 'verified'
            : finding.tag === 'inference'
              ? 'inference'
              : 'unconfirmed',
        claim: finding.claim,
        source_label: finding.sourceLabel,
        source_url: finding.sourceUrl,
        source_path: finding.sourcePath,
        review_required: finding.reviewRequired,
      })),
    });

    return new NextResponse(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${slugify(row.title)}.md"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
