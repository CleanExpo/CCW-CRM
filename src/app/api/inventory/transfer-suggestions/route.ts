import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { expandWarehouseLocations, totalsFromExpanded } from '@/lib/db/inventory-product-view';
import {
  INVENTORY_LOCATION_STOCK_SELECT,
  isMissingInventoryTableError,
  toProductLocationRows,
} from '@/lib/db/inventory-api-helpers';

const TRANSFER_UNIT_COST = 2.5;

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);

    const products = await prisma.product.findMany({
      where: { isActive: true, ownerUserId: { in: workspaceUserIds } },
      select: {
        id: true,
        sku: true,
        name: true,
        price: true,
        stock: true,
        warehouseLocation: true,
        locationStocks: { select: INVENTORY_LOCATION_STOCK_SELECT },
      },
    });

    const suggestions: Array<{
      id: string;
      product_id: string;
      product_sku: string;
      product_name: string;
      from_location: string;
      to_location: string;
      suggested_quantity: number;
      priority: 'high' | 'medium' | 'low';
      reason: string;
      current_stock_from: number;
      current_stock_to: number;
      projected_stock_from: number;
      projected_stock_to: number;
      estimated_cost: number;
      potential_revenue_impact: number;
    }> = [];

    for (const p of products) {
      const rows = toProductLocationRows(p.locationStocks);
      const locs = expandWarehouseLocations(p.stock, p.warehouseLocation, rows);
      const { totalAvailable } = totalsFromExpanded(locs);
      if (totalAvailable < 5) continue;

      let maxLoc = locs[0];
      let minLoc = locs[0];
      for (const l of locs) {
        if (l.available > maxLoc.available) maxLoc = l;
        if (l.available < minLoc.available) minLoc = l;
      }

      if (maxLoc.location === minLoc.location) continue;
      const skew = maxLoc.available - minLoc.available;
      if (skew < 8) continue;
      if (minLoc.available > 0 && skew < 15) continue;

      const move = Math.min(
        maxLoc.available - minLoc.available,
        Math.max(1, Math.floor(skew / 2)),
        maxLoc.available,
      );
      if (move < 1) continue;

      const projectedFrom = maxLoc.stock - move;
      const projectedTo = minLoc.stock + move;
      const estimatedCost = move * TRANSFER_UNIT_COST;
      const potentialRevenueImpact = move * p.price * 0.12;

      const priority: 'high' | 'medium' | 'low' =
        minLoc.available === 0 ? 'high' : skew >= 30 ? 'medium' : 'low';

      suggestions.push({
        id: `ts-${p.id}-${maxLoc.location}-${minLoc.location}`,
        product_id: p.id,
        product_sku: p.sku,
        product_name: p.name,
        from_location: maxLoc.location,
        to_location: minLoc.location,
        suggested_quantity: move,
        priority,
        reason: `Rebalance: ${maxLoc.location} holds ${maxLoc.available} available vs ${minLoc.available} at ${minLoc.location}. Moving stock reduces stock-outs and fulfilment risk.`,
        current_stock_from: maxLoc.stock,
        current_stock_to: minLoc.stock,
        projected_stock_from: projectedFrom,
        projected_stock_to: projectedTo,
        estimated_cost: Math.round(estimatedCost * 100) / 100,
        potential_revenue_impact: Math.round(potentialRevenueImpact * 100) / 100,
      });
    }

    suggestions.sort((a, b) => b.potential_revenue_impact - a.potential_revenue_impact);

    const total_estimated_cost = suggestions.reduce((s, x) => s + x.estimated_cost, 0);
    const total_potential_revenue = suggestions.reduce((s, x) => s + x.potential_revenue_impact, 0);

    return NextResponse.json({
      suggestions,
      total_potential_revenue: Math.round(total_potential_revenue * 100) / 100,
      total_estimated_cost: Math.round(total_estimated_cost * 100) / 100,
    });
  } catch (e) {
    if (isMissingInventoryTableError(e)) {
      return NextResponse.json({
        suggestions: [],
        total_potential_revenue: 0,
        total_estimated_cost: 0,
      });
    }
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
