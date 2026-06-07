import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { workspaceOwnerIds } from '@/lib/bank-reconciliation/scope';

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const body = (await request.json()) as {
      facility_id?: string;
      lc_id?: string;
      advance_number?: string;
      supplier_id?: string;
      purchase_order_id?: string;
      drawdown_date?: string;
      maturity_date?: string;
      principal_amount?: number;
      fees?: number;
      interest?: number;
      security_ref?: string;
      currency?: string;
    };

    if (!body.facility_id || !body.advance_number || !body.drawdown_date || !body.maturity_date) {
      return NextResponse.json(
        { detail: 'facility_id, advance_number, drawdown_date, maturity_date are required' },
        { status: 400 }
      );
    }

    const ownerIds = await workspaceOwnerIds(scope.userId);
    const facility = await prisma.tradeFinanceFacility.findFirst({
      where: { id: body.facility_id, ownerUserId: { in: ownerIds } },
    });
    if (!facility) {
      return NextResponse.json({ detail: 'Facility not found' }, { status: 404 });
    }

    const advance = await prisma.tradeFinanceAdvance.create({
      data: {
        facilityId: facility.id,
        ownerUserId: scope.userId,
        advanceNumber: body.advance_number.trim(),
        supplierId: body.supplier_id ?? null,
        purchaseOrderId: body.purchase_order_id ?? null,
        lcId: body.lc_id ?? null,
        drawdownDate: new Date(body.drawdown_date),
        maturityDate: new Date(body.maturity_date),
        principalAmount: Number(body.principal_amount ?? 0),
        fees: Number(body.fees ?? 0),
        interest: Number(body.interest ?? 0),
        securityRef: body.security_ref ?? null,
        currency: body.currency?.trim() || 'AUD',
        status: 'drawn',
      },
    });

    return NextResponse.json({ id: advance.id, advance_number: advance.advanceNumber }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
