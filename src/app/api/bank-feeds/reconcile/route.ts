import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function POST(request: NextRequest) {
  try {
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
