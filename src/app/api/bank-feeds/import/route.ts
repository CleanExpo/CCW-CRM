import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { parseCdrCsv, validateCdrRows } from '@/lib/bank-reconciliation/cdr-import';
import { bankAccountOwnerFilter, workspaceOwnerIds } from '@/lib/bank-reconciliation/scope';
import { refreshFeedSuggestions } from '@/lib/bank-reconciliation/match-suggestions';

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') ?? '';
    let accountId: string | null = null;
    let csvContent = '';

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      accountId = String(form.get('account_id') ?? '').trim() || null;
      const file = form.get('file');
      if (file instanceof File) {
        csvContent = await file.text();
      } else {
        csvContent = String(form.get('csv_content') ?? '');
      }
    } else {
      const body = (await request.json()) as { account_id?: string; csv_content?: string };
      accountId = body.account_id?.trim() ?? null;
      csvContent = String(body.csv_content ?? '');
    }

    if (!accountId) {
      return NextResponse.json({ detail: 'account_id is required' }, { status: 400 });
    }
    if (!csvContent.trim()) {
      return NextResponse.json({ detail: 'CSV content is required' }, { status: 400 });
    }

    const ownerIds = await workspaceOwnerIds(scope.userId);
    const account = await prisma.bankAccount.findFirst({
      where: { id: accountId, ...bankAccountOwnerFilter(ownerIds), isActive: true },
    });
    if (!account) {
      return NextResponse.json({ detail: 'Bank account not found' }, { status: 404 });
    }

    const parsed = parseCdrCsv(csvContent);
    const { valid, skipped } = validateCdrRows(parsed);

    let imported = 0;
    for (const row of valid) {
      try {
        await prisma.bankFeedTransaction.create({
          data: {
            bankAccountId: account.id,
            transactionDate: new Date(row.transaction_date),
            description: row.description,
            rawNarration: row.raw_narration ?? row.description,
            reference: row.reference ?? '',
            credit: row.credit,
            debit: row.debit,
            balance: row.balance,
            externalFeedId: row.external_feed_id ?? null,
            status: 'unmatched',
          },
        });
        imported++;
      } catch {
        // duplicate external_feed_id — skip
      }
    }

    await prisma.bankAccount.update({
      where: { id: account.id },
      data: { lastFeedSyncAt: new Date(), feedProvider: account.feedProvider === 'manual' ? 'cdr' : account.feedProvider },
    });

    const recent = await prisma.bankFeedTransaction.findMany({
      where: { bankAccountId: account.id, reconciled: false },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    for (const feed of recent) {
      await refreshFeedSuggestions(feed.id, scope.userId);
    }

    return NextResponse.json({
      imported,
      skipped,
      provider: 'cdr',
      account_id: account.id,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
