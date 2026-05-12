import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { getEquipmentWarrantyStats } from '@/lib/db/workshop-service';

/**
 * GET /api/equipment/stats
 * Dashboard warranty strip — workshop equipment with approaching or recently expired warranty.
 */
export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const stats = await getEquipmentWarrantyStats(workspaceUserIds);
    return NextResponse.json(stats);
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
