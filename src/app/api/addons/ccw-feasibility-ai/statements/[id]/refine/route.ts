import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { findingsPayloadFromMarkdown } from '@/lib/feasibility/statement-read-path';

type Params = { params: Promise<{ id: string }> };

function buildRefinedMarkdown(parentTitle: string, parentContent: string | null, note: string) {
  return `${parentContent || `# ${parentTitle}`}

## Refinement Note

${note}

- [INFERENCE] This version descends from an earlier owner-visible feasibility statement and should be reviewed against its parent before approval.
- [UNCONFIRMED] Assumption: Toby still accepts the previous decision gates unless this refinement explicitly changes them.
`;
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const parent = await prisma.ccwFeasibilityStatement.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds } },
      select: { id: true, title: true, objective: true, contentMarkdown: true },
    });
    if (!parent) return NextResponse.json({ detail: 'Parent statement not found' }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const refinementNote =
      typeof body.refinement_note === 'string' && body.refinement_note.trim()
        ? body.refinement_note.trim()
        : 'Owner-requested refinement for the next feasibility version.';
    const title =
      typeof body.title === 'string' && body.title.trim()
        ? body.title.trim()
        : `${parent.title} - refinement`;
    const contentMarkdown =
      typeof body.content_markdown === 'string' && body.content_markdown.trim()
        ? body.content_markdown
        : buildRefinedMarkdown(parent.title, parent.contentMarkdown, refinementNote);
    const evidence = findingsPayloadFromMarkdown(contentMarkdown);

    const child = await prisma.ccwFeasibilityStatement.create({
      data: {
        ownerUserId: scope.userId,
        parentStatementId: parent.id,
        title,
        objective: parent.objective,
        status: 'draft',
        contentMarkdown,
        evidenceSummary: evidence.summary,
        generatedBy: 'refinement',
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
      select: {
        id: true,
        title: true,
        objective: true,
        status: true,
        parentStatementId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        id: child.id,
        title: child.title,
        objective: child.objective,
        status: child.status,
        parent_statement_id: child.parentStatementId,
        created_at: child.createdAt.toISOString(),
        updated_at: child.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
