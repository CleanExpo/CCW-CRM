import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { isWarehouseLocation, normalizeWarehouseLocation } from '@/lib/db/inventory-location-transfer';
import { isMissingInventoryTableError } from '@/lib/db/inventory-api-helpers';

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ detail: 'Invalid JSON body' }, { status: 400 });
    }

    const locRaw = String(body.location ?? '').toLowerCase().trim();
    if (!isWarehouseLocation(locRaw)) {
      return NextResponse.json({ detail: 'location must be brisbane, sydney, or melbourne' }, { status: 400 });
    }
    const location = normalizeWarehouseLocation(locRaw);

    const take = await prisma.inventoryStockTake.create({
      data: {
        ownerUserId: scope.userId,
        location,
        status: 'in_progress',
      },
    });

    return NextResponse.json({
      id: take.id,
      location: take.location,
      status: take.status,
      created_at: take.createdAt.toISOString(),
    });
  } catch (e) {
    if (isMissingInventoryTableError(e)) {
      return NextResponse.json({ detail: 'Run prisma migrate deploy.' }, { status: 503 });
    }
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
