import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const body = (await request.json()) as {
      feed_id?: string;
      pos_transaction_id?: string;
    };

    const feedId = String(body.feed_id ?? '');
    const posId = String(body.pos_transaction_id ?? '');
    if (!feedId || !posId) {
      return NextResponse.json(
        { detail: 'feed_id and pos_transaction_id are required' },
        { status: 400 }
      );
    }

    const feed = await prisma.bankFeedTransaction.findFirst({
      where: { id: feedId, bankAccount: { ownerUserId: scope.userId } },
    });
    const pos = await prisma.posTransaction.findFirst({
      where: { id: posId, ownerUserId: scope.userId },
    });
    if (!feed || !pos) {
      return NextResponse.json({ detail: 'Feed line or POS transaction not found' }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.bankFeedTransaction.update({
        where: { id: feedId },
        data: { reconciled: true, matchedPosTxId: posId },
      }),
      prisma.posTransaction.update({
        where: { id: posId },
        data: { reconciliationStatus: 'reconciled' },
      }),
    ]);

    return NextResponse.json({
      feed_id: feedId,
      pos_transaction_id: posId,
      status: 'reconciled',
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
