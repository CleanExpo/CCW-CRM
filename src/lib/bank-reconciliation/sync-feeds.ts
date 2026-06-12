import { prisma } from '@/lib/db/prisma';
import {
  fetchCdrBankTransactions,
  isCdrFeedProvider,
} from '@/lib/integrations/cdr-bank-feed';
import { refreshFeedSuggestions } from '@/lib/bank-reconciliation/match-suggestions';
import { bankAccountOwnerFilter, workspaceOwnerIds } from '@/lib/bank-reconciliation/scope';

export async function syncBankAccountFeeds(input: {
  userId: string;
  accountId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}) {
  const ownerIds = await workspaceOwnerIds(input.userId);
  let accountId = input.accountId;
  if (!accountId) {
    const first = await prisma.bankAccount.findFirst({
      where: { ...bankAccountOwnerFilter(ownerIds), isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!first) {
      return { ok: false as const, status: 400, body: { detail: 'No bank accounts configured' } };
    }
    accountId = first.id;
  }

  const account = await prisma.bankAccount.findFirst({
    where: { id: accountId, ...bankAccountOwnerFilter(ownerIds) },
  });
  if (!account) {
    return { ok: false as const, status: 404, body: { detail: 'Account not found' } };
  }

  const start = input.startDate ?? new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const end = input.endDate ?? new Date().toISOString().split('T')[0];
  const createdIds: string[] = [];
  let message: string | undefined;
  let provider = account.feedProvider;
  let mode: string | undefined;

  if (isCdrFeedProvider(account.feedProvider)) {
    const cdr = await fetchCdrBankTransactions({
      cdrAccountId: account.cdrAccountId,
      accountNumber: account.accountNumber,
      bsb: account.bsb,
      startDate: start,
      endDate: end,
    });
    provider = cdr.provider;
    mode = cdr.mode;
    message = cdr.message;

    for (const row of cdr.rows) {
      try {
        const created = await prisma.bankFeedTransaction.create({
          data: {
            bankAccountId: accountId,
            transactionDate: row.transaction_date,
            description: row.description,
            rawNarration: row.raw_narration ?? row.description,
            reference: row.reference,
            credit: row.credit,
            debit: row.debit,
            balance: row.balance,
            reconciled: false,
            status: 'unmatched',
            externalFeedId: row.external_feed_id,
          },
        });
        createdIds.push(created.id);
      } catch {
        // Skip duplicates (unique bankAccountId + externalFeedId)
      }
    }
  } else if (account.feedProvider === 'manual') {
    message = 'Manual account — import CSV or switch feed provider to CDR/Basiq for automated sync.';
  } else {
    const n = Math.floor(1 + Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const amt = Math.round((20 + Math.random() * 200) * 100) / 100;
      const isCredit = Math.random() > 0.4;
      const row = await prisma.bankFeedTransaction.create({
        data: {
          bankAccountId: accountId,
          transactionDate: new Date(),
          description: isCredit ? 'Customer payment — demo feed' : 'Supplier payment — demo feed',
          rawNarration: `Demo sync ${account.accountName}`,
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
  }

  await prisma.bankAccount.update({
    where: { id: accountId },
    data: { lastFeedSyncAt: new Date() },
  });

  for (const id of createdIds) {
    await refreshFeedSuggestions(id, input.userId);
  }

  return {
    ok: true as const,
    status: 200,
    body: {
      transactions_synced: createdIds.length,
      provider,
      mode,
      start_date: start,
      end_date: end,
      message,
    },
  };
}
