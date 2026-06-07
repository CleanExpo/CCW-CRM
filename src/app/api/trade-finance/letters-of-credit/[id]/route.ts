import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { workspaceOwnerIds } from '@/lib/bank-reconciliation/scope';
import { serializeLetterOfCredit } from '@/lib/trade-finance/serialize';
import { logOperationalEvent } from '@/lib/comms/operational-events';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await context.params;
    const ownerIds = await workspaceOwnerIds(scope.userId);

    const row = await prisma.tradeFinanceLetterOfCredit.findFirst({
      where: { id, ownerUserId: { in: ownerIds } },
      include: {
        beneficiary: { select: { companyName: true } },
        purchaseOrder: { select: { poNumber: true } },
        facility: { select: { name: true } },
        documents: { orderBy: { createdAt: 'desc' } },
        amendments: { orderBy: { amendmentNumber: 'asc' } },
        advances: {
          include: {
            supplier: { select: { companyName: true } },
            purchaseOrder: { select: { poNumber: true } },
          },
        },
        _count: { select: { documents: true, advances: true } },
      },
    });

    if (!row) return NextResponse.json({ detail: 'Not found' }, { status: 404 });

    return NextResponse.json({
      ...serializeLetterOfCredit(row),
      documents: row.documents.map((d) => ({
        id: d.id,
        doc_type: d.docType,
        file_name: d.fileName,
        status: d.status,
        presented_at: d.presentedAt?.toISOString() ?? null,
        accepted_at: d.acceptedAt?.toISOString() ?? null,
        notes: d.notes,
      })),
      amendments: row.amendments.map((a) => ({
        id: a.id,
        amendment_number: a.amendmentNumber,
        description: a.description,
        effective_date: a.effectiveDate.toISOString().slice(0, 10),
      })),
      linked_advances: row.advances.map((a) => ({
        id: a.id,
        advance_number: a.advanceNumber,
        principal_amount: a.principalAmount,
        status: a.status,
      })),
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await context.params;
    const ownerIds = await workspaceOwnerIds(scope.userId);
    const body = (await request.json()) as { status?: string; notes?: string };

    const existing = await prisma.tradeFinanceLetterOfCredit.findFirst({
      where: { id, ownerUserId: { in: ownerIds } },
    });
    if (!existing) return NextResponse.json({ detail: 'Not found' }, { status: 404 });

    const row = await prisma.tradeFinanceLetterOfCredit.update({
      where: { id },
      data: {
        status: body.status,
        notes: body.notes,
      },
      include: {
        beneficiary: { select: { companyName: true } },
        purchaseOrder: { select: { poNumber: true } },
        facility: { select: { name: true } },
        _count: { select: { documents: true, advances: true } },
      },
    });

    if (body.status) {
      await logOperationalEvent({
        ownerUserId: scope.userId,
        eventType: 'trade_finance',
        source: 'system',
        title: `LC ${row.lcNumber} → ${body.status}`,
        entityType: 'letter_of_credit',
        entityId: row.id,
      });
    }

    return NextResponse.json(serializeLetterOfCredit(row));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
