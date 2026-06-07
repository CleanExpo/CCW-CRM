import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { workspaceOwnerIds } from '@/lib/bank-reconciliation/scope';
import { serializeLetterOfCredit } from '@/lib/trade-finance/serialize';
import { logOperationalEvent } from '@/lib/comms/operational-events';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const ownerIds = await workspaceOwnerIds(scope.userId);
    const status = request.nextUrl.searchParams.get('status');

    const rows = await prisma.tradeFinanceLetterOfCredit.findMany({
      where: {
        ownerUserId: { in: ownerIds },
        ...(status ? { status } : {}),
      },
      include: {
        beneficiary: { select: { companyName: true } },
        purchaseOrder: { select: { poNumber: true } },
        facility: { select: { name: true } },
        _count: { select: { documents: true, advances: true } },
      },
      orderBy: { expiryDate: 'asc' },
    });

    return NextResponse.json(rows.map(serializeLetterOfCredit));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const body = (await request.json()) as {
      lc_number?: string;
      facility_id?: string;
      bank_ref?: string;
      beneficiary_supplier_id?: string;
      purchase_order_id?: string;
      amount?: number;
      currency?: string;
      lc_type?: string;
      issue_date?: string;
      expiry_date?: string;
      notes?: string;
    };

    if (!body.lc_number?.trim() || !body.issue_date || !body.expiry_date || body.amount == null) {
      return NextResponse.json(
        { detail: 'lc_number, issue_date, expiry_date, and amount are required' },
        { status: 400 }
      );
    }

    const row = await prisma.tradeFinanceLetterOfCredit.create({
      data: {
        ownerUserId: scope.userId,
        facilityId: body.facility_id ?? null,
        lcNumber: body.lc_number.trim(),
        bankRef: body.bank_ref ?? null,
        beneficiarySupplierId: body.beneficiary_supplier_id ?? null,
        purchaseOrderId: body.purchase_order_id ?? null,
        amount: Number(body.amount),
        currency: body.currency?.trim() || 'AUD',
        lcType: body.lc_type?.trim() || 'usance',
        issueDate: new Date(body.issue_date),
        expiryDate: new Date(body.expiry_date),
        notes: body.notes ?? null,
        status: 'issued',
      },
      include: {
        beneficiary: { select: { companyName: true } },
        purchaseOrder: { select: { poNumber: true } },
        facility: { select: { name: true } },
        _count: { select: { documents: true, advances: true } },
      },
    });

    await logOperationalEvent({
      ownerUserId: scope.userId,
      eventType: 'trade_finance',
      source: 'system',
      title: `LC ${row.lcNumber} issued`,
      entityType: 'letter_of_credit',
      entityId: row.id,
      metadata: { amount: row.amount, lc_type: row.lcType },
    });

    return NextResponse.json(serializeLetterOfCredit(row), { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
