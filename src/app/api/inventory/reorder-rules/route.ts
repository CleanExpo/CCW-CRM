import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import {
  ensureProductLocationStockRows,
  isWarehouseLocation,
  normalizeWarehouseLocation,
} from '@/lib/db/inventory-location-transfer';
import { isMissingInventoryTableError } from '@/lib/db/inventory-api-helpers';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const locationFilter = new URL(request.url).searchParams.get('location')?.trim();

    const products = await prisma.product.findMany({
      where: { isActive: true, ownerUserId: { in: workspaceUserIds } },
      include: { locationStocks: true },
    });

    const rules: Array<{
      id: string;
      product_id: string;
      location: string;
      supplier_id: string | null;
      auto_approve_under_qty: number;
      lead_time_days: number;
      is_enabled: boolean;
    }> = [];

    for (const p of products) {
      for (const row of p.locationStocks) {
        if (locationFilter && row.location !== locationFilter) continue;
        rules.push({
          id: row.id,
          product_id: p.id,
          location: row.location,
          supplier_id: null,
          auto_approve_under_qty: row.autoApproveUnderQty,
          lead_time_days: row.leadTimeDays,
          is_enabled: row.reorderEnabled,
        });
      }
    }

    return NextResponse.json(rules);
  } catch (e) {
    if (isMissingInventoryTableError(e)) {
      return NextResponse.json([]);
    }
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ detail: 'Invalid JSON body' }, { status: 400 });
    }

    const productId = String(body.product_id ?? '').trim();
    const locRaw = String(body.location ?? '').toLowerCase().trim();
    if (!productId || !isWarehouseLocation(locRaw)) {
      return NextResponse.json({ detail: 'product_id and valid location required' }, { status: 400 });
    }
    const location = normalizeWarehouseLocation(locRaw);

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        isActive: true,
        ownerUserId: { in: workspaceUserIds },
      },
      select: { id: true, stock: true, warehouseLocation: true },
    });

    if (!product) {
      return NextResponse.json({ detail: 'Product not found' }, { status: 404 });
    }

    const autoApprove = Math.max(
      0,
      Math.floor(Number(body.auto_approve_under_qty ?? body.autoApproveUnderQty ?? 0)),
    );
    const leadDays = Math.max(1, Math.floor(Number(body.lead_time_days ?? body.leadTimeDays ?? 7)));
    const isEnabled =
      body.is_enabled === undefined && body.isEnabled === undefined
        ? true
        : Boolean(body.is_enabled ?? body.isEnabled);

    const row = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      await ensureProductLocationStockRows(tx, product);
      return tx.productLocationStock.update({
        where: { productId_location: { productId: product.id, location } },
        data: {
          autoApproveUnderQty: autoApprove,
          leadTimeDays: leadDays,
          reorderEnabled: isEnabled,
        },
      });
    });

    return NextResponse.json({ id: row.id });
  } catch (e) {
    if (isMissingInventoryTableError(e)) {
      return NextResponse.json({ detail: 'Run prisma migrate deploy.' }, { status: 503 });
    }
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
