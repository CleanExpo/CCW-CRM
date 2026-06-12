import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { workspaceOwnerIds } from '@/lib/bank-reconciliation/scope';
import { logOperationalEvent } from '@/lib/comms/operational-events';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id: lcId } = await context.params;
    const ownerIds = await workspaceOwnerIds(scope.userId);

    const lc = await prisma.tradeFinanceLetterOfCredit.findFirst({
      where: { id: lcId, ownerUserId: { in: ownerIds } },
    });
    if (!lc) return NextResponse.json({ detail: 'Not found' }, { status: 404 });

    const body = (await request.json()) as {
      doc_type?: string;
      file_name?: string;
      status?: string;
      notes?: string;
      presented_at?: string;
    };

    if (!body.doc_type?.trim()) {
      return NextResponse.json({ detail: 'doc_type is required' }, { status: 400 });
    }

    const doc = await prisma.tradeFinanceLcDocument.create({
      data: {
        lcId,
        docType: body.doc_type.trim(),
        fileName: body.file_name?.trim() ?? null,
        status: body.status?.trim() ?? 'pending',
        presentedAt: body.presented_at ? new Date(body.presented_at) : new Date(),
        notes: body.notes ?? null,
      },
    });

    await logOperationalEvent({
      ownerUserId: scope.userId,
      eventType: 'trade_finance',
      source: 'system',
      title: `LC document uploaded: ${body.doc_type}`,
      description: lc.lcNumber,
      entityType: 'letter_of_credit',
      entityId: lc.id,
      metadata: { document_id: doc.id, doc_type: doc.docType },
    });

    return NextResponse.json(
      {
        id: doc.id,
        doc_type: doc.docType,
        file_name: doc.fileName,
        status: doc.status,
        presented_at: doc.presentedAt?.toISOString() ?? null,
        accepted_at: doc.acceptedAt?.toISOString() ?? null,
        notes: doc.notes,
      },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
