/**
 * GET  /api/pricing/price-lists  — list all price lists for this workspace
 * POST /api/pricing/price-lists  — create a new price list
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const rows = await prisma.priceList.findMany({
      where: { ownerUserId: { in: workspaceUserIds } },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        price_overrides: r.priceOverrides,
        volume_breaks: r.volumeBreaks,
        is_active: r.isActive,
        created_at: r.createdAt,
        updated_at: r.updatedAt,
      }))
    );
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const body = (await request.json()) as {
      name?: string;
      description?: string;
      price_overrides?: unknown;
      volume_breaks?: unknown;
      is_active?: boolean;
    };

    const name = String(body.name ?? '').trim();
    if (!name) {
      return NextResponse.json({ detail: 'name is required' }, { status: 400 });
    }

    const priceOverrides = Array.isArray(body.price_overrides) ? body.price_overrides : [];
    const volumeBreaks = Array.isArray(body.volume_breaks) ? body.volume_breaks : [];

    const row = await prisma.priceList.create({
      data: {
        ownerUserId: scope.userId,
        name,
        description: body.description ? String(body.description) : null,
        priceOverrides,
        volumeBreaks,
        isActive: body.is_active !== false,
      },
    });

    return NextResponse.json(
      {
        id: row.id,
        name: row.name,
        description: row.description,
        price_overrides: row.priceOverrides,
        volume_breaks: row.volumeBreaks,
        is_active: row.isActive,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
      },
      { status: 201 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes('Unique constraint') ? 409 : 500;
    return NextResponse.json({ detail: msg }, { status });
  }
}
