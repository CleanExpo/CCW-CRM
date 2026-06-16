import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function knowledgeSource(row: {
  id: string;
  sourceType: string;
  label: string;
  url: string | null;
  trustLevel: string;
  refreshCadence: string | null;
  lastIndexedAt: Date | null;
  status: string;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    source_type: row.sourceType,
    label: row.label,
    url: row.url,
    trust_level: row.trustLevel,
    refresh_cadence: row.refreshCadence,
    last_indexed_at: row.lastIndexedAt?.toISOString() ?? null,
    status: row.status,
    metadata: row.metadata,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const rows = await prisma.ccwAiKnowledgeSource.findMany({
      where: { ownerUserId: { in: workspaceUserIds } },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: 100,
    });

    return NextResponse.json({ items: rows.map(knowledgeSource), total: rows.length });
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const label = text(body.label);
    if (!label) return NextResponse.json({ detail: 'label is required' }, { status: 400 });

    const row = await prisma.ccwAiKnowledgeSource.create({
      data: {
        ownerUserId: scope.userId,
        sourceType: text(body.source_type, 'website'),
        label,
        url: text(body.url) || null,
        trustLevel: text(body.trust_level, 'trusted'),
        refreshCadence: text(body.refresh_cadence) || null,
        status: text(body.status, 'active'),
        metadata: {
          approved_for_phone_answers: true,
          captured_by: scope.userId,
        },
      },
    });

    return NextResponse.json(knowledgeSource(row), { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
