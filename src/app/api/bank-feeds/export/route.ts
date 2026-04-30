import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

function toCsvCell(value: string | number | null | undefined) {
  const raw = value === null || value === undefined ? '' : String(value);
  return `"${raw.replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account_id');
    const status = searchParams.get('status');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const rows = await prisma.bankFeedTransaction.findMany({
      where: {
        ...(accountId ? { bankAccountId: accountId } : {}),
        ...(status === 'matched'
          ? { reconciled: true }
          : status === 'unmatched'
            ? { reconciled: false }
            : {}),
        ...(startDate || endDate
          ? {
              transactionDate: {
                ...(startDate ? { gte: new Date(`${startDate}T00:00:00.000Z`) } : {}),
                ...(endDate ? { lte: new Date(`${endDate}T23:59:59.999Z`) } : {}),
              },
            }
          : {}),
      },
      orderBy: { transactionDate: 'desc' },
      take: 5000,
    });

    const header = [
      'Date',
      'BankFeedId',
      'Reference',
      'Description',
      'Credit',
      'Debit',
      'MatchedPosTransactionId',
      'Status',
    ];

    const lines = [header.map(toCsvCell).join(',')];
    for (const row of rows) {
      lines.push(
        [
          row.transactionDate.toISOString(),
          row.id,
          row.reference ?? '',
          row.description,
          row.credit ?? '',
          row.debit ?? '',
          row.matchedPosTxId ?? '',
          row.reconciled ? 'matched' : 'unmatched',
        ]
          .map(toCsvCell)
          .join(',')
      );
    }

    const csv = `\uFEFF${lines.join('\n')}`;
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="reconciliation-export.csv"',
      },
    });
  } catch (error) {
    return NextResponse.json({ detail: String(error) }, { status: 500 });
  }
}
