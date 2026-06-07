import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { workspaceOwnerIds } from '@/lib/bank-reconciliation/scope';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const ownerIds = await workspaceOwnerIds(scope.userId);
    const facilities = await prisma.tradeFinanceFacility.findMany({
      where: { ownerUserId: { in: ownerIds } },
      include: {
        advances: {
          include: {
            supplier: { select: { companyName: true } },
            purchaseOrder: { select: { poNumber: true } },
          },
          orderBy: { maturityDate: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(
      facilities.map((f) => {
        const drawn = f.advances.reduce((s, a) => s + a.principalAmount, 0);
        const repaid = f.advances.reduce((s, a) => s + a.repaidAmount, 0);
        return {
          id: f.id,
          provider: f.provider,
          name: f.name,
          facility_limit: f.facilityLimit,
          currency: f.currency,
          status: f.status,
          drawn_total: drawn,
          available: Math.max(f.facilityLimit - drawn + repaid, 0),
          advances: f.advances.map((a) => ({
            id: a.id,
            advance_number: a.advanceNumber,
            supplier: a.supplier?.companyName ?? null,
            shipment: a.purchaseOrder?.poNumber ?? null,
            drawn: a.principalAmount,
            due: a.maturityDate.toISOString().slice(0, 10),
            balance: a.principalAmount - a.repaidAmount,
            status: a.status,
          })),
        };
      })
    );
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const body = (await request.json()) as {
      name?: string;
      provider?: string;
      facility_limit?: number;
      currency?: string;
    };

    if (!body.name?.trim() || body.facility_limit == null) {
      return NextResponse.json({ detail: 'name and facility_limit are required' }, { status: 400 });
    }

    const facility = await prisma.tradeFinanceFacility.create({
      data: {
        ownerUserId: scope.userId,
        name: body.name.trim(),
        provider: body.provider?.trim() || 'CBA',
        facilityLimit: Number(body.facility_limit),
        currency: body.currency?.trim() || 'AUD',
      },
    });

    return NextResponse.json({ id: facility.id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
