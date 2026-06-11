import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account_id');

    const rows = await prisma.bankFeedTransaction.findMany({
      where: {
        reconciled: false,
        bankAccount: { ownerUserId: scope.userId },
        ...(accountId ? { bankAccountId: accountId } : {}),
      },
      orderBy: { transactionDate: 'desc' },
      take: 500,
    });

    return NextResponse.json(
      rows.map((r: { id: string; bankAccountId: string; transactionDate: Date; description: string | null; reference: string | null; credit: number | null; debit: number | null; balance: number | null }) => ({
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
