import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function dateOrNull(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const rows = await prisma.ccwIndustryEvent.findMany({
      where: { ownerUserId: { in: workspaceUserIds } },
      orderBy: [{ startsAt: 'asc' }, { updatedAt: 'desc' }],
      take: 100,
    });

    return NextResponse.json({
      items: rows.map((row) => ({
        id: row.id,
        event_type: row.eventType,
        name: row.name,
        status: row.status,
        starts_at: row.startsAt?.toISOString() ?? null,
        ends_at: row.endsAt?.toISOString() ?? null,
        venue: row.venue,
        description: row.description,
        agenda: row.agenda,
        speaker_plan: row.speakerPlan,
        marketing_plan: row.marketingPlan,
        created_at: row.createdAt.toISOString(),
        updated_at: row.updatedAt.toISOString(),
      })),
      total: rows.length,
    });
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const name = text(body.name);
    if (!name) return NextResponse.json({ detail: 'name is required' }, { status: 400 });

    const row = await prisma.ccwIndustryEvent.create({
      data: {
        ownerUserId: scope.userId,
        eventType: text(body.event_type, 'company_day'),
        name,
        status: text(body.status, 'concept'),
        startsAt: dateOrNull(body.starts_at),
        endsAt: dateOrNull(body.ends_at),
        venue: text(body.venue) || null,
        description: text(body.description) || null,
        agenda: {
          objective: 'Create industry feel, appreciation, education, and qualified opportunities for CCW.',
          segments: ['guest speaker', 'supplier showcase', 'customer appreciation', 'training pathway'],
        },
        speakerPlan: {
          needs_toby_approval: true,
          suggested_sources: ['supplier calls', 'trusted industry partners', 'CARSI training topics'],
        },
        marketingPlan: {
          channels: ['newsletter', 'email campaign', 'social media blitz'],
          send_requires_approval: true,
        },
      },
    });

    return NextResponse.json(
      {
        id: row.id,
        event_type: row.eventType,
        name: row.name,
        status: row.status,
        starts_at: row.startsAt?.toISOString() ?? null,
        created_at: row.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
