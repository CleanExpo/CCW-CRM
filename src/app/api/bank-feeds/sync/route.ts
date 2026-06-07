import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { refreshFeedSuggestions } from '@/lib/bank-reconciliation/match-suggestions';
import { bankAccountOwnerFilter, workspaceOwnerIds } from '@/lib/bank-reconciliation/scope';

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const body = (await request.json()) as {
      account_id?: string | null;
      start_date?: string | null;
      end_date?: string | null;
    };

    const ownerIds = await workspaceOwnerIds(scope.userId);
    let accountId = body.account_id;
    if (!accountId) {
      const first = await prisma.bankAccount.findFirst({
        where: { ...bankAccountOwnerFilter(ownerIds), isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!first) {
        return NextResponse.json({ detail: 'No bank accounts configured' }, { status: 400 });
      }
      accountId = first.id;
    }

    const account = await prisma.bankAccount.findFirst({
      where: { id: accountId, ...bankAccountOwnerFilter(ownerIds) },
    });
    if (!account) {
      return NextResponse.json({ detail: 'Account not found' }, { status: 404 });
    }

    const start = body.start_date ?? new Date().toISOString().split('T')[0];
    const end = body.end_date ?? new Date().toISOString().split('T')[0];

    // Demo sync until CBA CDR live connection is registered
    const n = account.feedProvider === 'cdr' ? 0 : Math.floor(1 + Math.random() * 3);
    const createdIds: string[] = [];

    for (let i = 0; i < n; i++) {
      const amt = Math.round((20 + Math.random() * 200) * 100) / 100;
      const isCredit = Math.random() > 0.4;
      const row = await prisma.bankFeedTransaction.create({
        data: {
          bankAccountId: accountId,
          transactionDate: new Date(),
          description: isCredit ? 'Customer payment — demo feed' : 'Supplier payment — demo feed',
          rawNarration: `CBA demo sync ${account.accountName}`,
          reference: `SYNC-${Date.now()}-${i}`,
          credit: isCredit ? amt : null,
          debit: isCredit ? null : amt,
          balance: null,
          reconciled: false,
          status: 'unmatched',
          externalFeedId: `demo-${Date.now()}-${i}`,
        },
      });
      createdIds.push(row.id);
    }

    await prisma.bankAccount.update({
      where: { id: accountId },
      data: { lastFeedSyncAt: new Date() },
    });

    for (const id of createdIds) {
      await refreshFeedSuggestions(id, scope.userId);
    }

    return NextResponse.json({
      transactions_synced: n,
      provider: account.feedProvider,
      start_date: start,
      end_date: end,
      message:
        account.feedProvider === 'cdr'
          ? 'CDR account configured — import CSV via Bank Feeds until live CBA connection is active'
          : undefined,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
