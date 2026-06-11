import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { isMissingInventoryTableError } from '@/lib/db/inventory-api-helpers';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const location = searchParams.get('location')?.trim();
    const status = searchParams.get('status')?.trim();

    const rows = await prisma.inventoryStockTake.findMany({
      where: {
        ownerUserId: scope.userId,
        ...(location ? { location } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json(
      rows.map((t: { id: string; location: string; status: string; createdAt: Date; submittedAt: Date | null }) => ({
        id: t.id,
        location: t.location,
        status: t.status,
        created_at: t.createdAt.toISOString(),
        submitted_at: t.submittedAt?.toISOString() ?? null,
      })),
    );
  } catch (e) {
    if (isMissingInventoryTableError(e)) {
      return NextResponse.json([]);
    }
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
