import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account_id');

    const rows = await prisma.bankFeedTransaction.findMany({
      where: {
        reconciled: false,
        ...(accountId ? { bankAccountId: accountId } : {}),
      },
      orderBy: { transactionDate: 'desc' },
      take: 500,
    });

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        bank_account_id: r.bankAccountId,
        transaction_date: r.transactionDate.toISOString(),
        description: r.description,
        reference: r.reference || '',
        credit: r.credit,
        debit: r.debit,
        balance: r.balance,
      }))
    );
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
