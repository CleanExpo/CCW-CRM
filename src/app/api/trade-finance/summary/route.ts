import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { workspaceOwnerIds } from '@/lib/bank-reconciliation/scope';
import { serializeFacilityUtilisation } from '@/lib/trade-finance/serialize';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const ownerIds = await workspaceOwnerIds(scope.userId);

    const [facilities, advances, lcs] = await Promise.all([
      prisma.tradeFinanceFacility.findMany({
        where: { ownerUserId: { in: ownerIds } },
        include: { advances: { select: { principalAmount: true, repaidAmount: true } } },
      }),
      prisma.tradeFinanceAdvance.findMany({
        where: { ownerUserId: { in: ownerIds }, status: { notIn: ['repaid', 'closed'] } },
        select: { principalAmount: true, repaidAmount: true, maturityDate: true, status: true },
      }),
      prisma.tradeFinanceLetterOfCredit.count({
        where: {
          ownerUserId: { in: ownerIds },
          status: { notIn: ['paid', 'cancelled', 'expired'] },
        },
      }),
    ]);

    const facilityStats = facilities.map(serializeFacilityUtilisation);
    const totalLimit = facilityStats.reduce((s, f) => s + f.facility_limit, 0);
    const totalOutstanding = facilityStats.reduce((s, f) => s + f.outstanding, 0);
    const totalAvailable = facilityStats.reduce((s, f) => s + f.available, 0);

    const now = Date.now();
    const maturing14 = advances.filter((a) => {
      const ms = a.maturityDate.getTime() - now;
      return ms >= 0 && ms <= 14 * 86400000;
    }).length;
    const overdue = advances.filter((a) => a.status === 'overdue').length;

    return NextResponse.json({
      facility_count: facilities.length,
      total_limit: totalLimit,
      total_outstanding: totalOutstanding,
      total_available: totalAvailable,
      open_advances: advances.length,
      advances_overdue: overdue,
      advances_maturing_14d: maturing14,
      active_letters_of_credit: lcs,
      facilities: facilityStats,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
