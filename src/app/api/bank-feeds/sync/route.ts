import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      account_id?: string | null;
      start_date?: string | null;
      end_date?: string | null;
    };

    let accountId = body.account_id;
    if (!accountId) {
      const first = await prisma.bankAccount.findFirst({ orderBy: { createdAt: 'asc' } });
      if (!first) {
        return NextResponse.json({ detail: 'No bank accounts configured' }, { status: 400 });
      }
      accountId = first.id;
    }

    const account = await prisma.bankAccount.findUnique({ where: { id: accountId } });
    if (!account) {
      return NextResponse.json({ detail: 'Account not found' }, { status: 404 });
    }

    const n = Math.floor(1 + Math.random() * 2);
    const start = body.start_date ?? new Date().toISOString().split('T')[0];
    const end = body.end_date ?? new Date().toISOString().split('T')[0];

    for (let i = 0; i < n; i++) {
      const amt = Math.round((20 + Math.random() * 200) * 100) / 100;
      await prisma.bankFeedTransaction.create({
        data: {
          bankAccountId: accountId,
          transactionDate: new Date(),
          description: `Imported feed — ${account.feedProvider}`,
          reference: `SYNC-${Date.now()}-${i}`,
          credit: amt,
          debit: null,
          balance: null,
          reconciled: false,
        },
      });
    }

    return NextResponse.json({
      transactions_synced: n,
      provider: account.feedProvider,
      start_date: start,
      end_date: end,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
