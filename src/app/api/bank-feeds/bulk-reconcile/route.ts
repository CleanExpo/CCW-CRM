import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      matches?: Array<{ bank_feed_id?: string; pos_transaction_id?: string }>;
    };

    const matches = Array.isArray(body.matches) ? body.matches : [];
    if (matches.length === 0) {
      return NextResponse.json({ detail: 'matches array is required' }, { status: 400 });
    }

    let matched = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const match of matches) {
      const feedId = String(match.bank_feed_id ?? '');
      const posId = String(match.pos_transaction_id ?? '');
      if (!feedId || !posId) {
        failed += 1;
        errors.push('Missing bank_feed_id or pos_transaction_id');
        continue;
      }

      try {
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
        matched += 1;
      } catch (error) {
        failed += 1;
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    return NextResponse.json({
      success: failed === 0,
      matched_count: matched,
      failed_count: failed,
      errors,
    });
  } catch (error) {
    return NextResponse.json({ detail: String(error) }, { status: 500 });
  }
}
