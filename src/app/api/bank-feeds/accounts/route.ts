import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import type { BankAccount as BankAccountRow } from '@prisma/client';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { bankAccountOwnerFilter, workspaceOwnerIds } from '@/lib/bank-reconciliation/scope';

function toApi(a: BankAccountRow) {
  return {
    id: a.id,
    account_name: a.accountName,
    account_number: a.accountNumber,
    bsb: a.bsb,
    bank_name: a.bankName,
    account_type: a.accountType as 'checking' | 'savings' | 'credit',
    feed_provider: a.feedProvider as 'xero' | 'yodlee' | 'basiq' | 'manual',
    is_active: a.isActive,
    created_at: a.createdAt.toISOString(),
    updated_at: a.updatedAt.toISOString(),
    location_code: a.locationCode ?? undefined,
    last_feed_sync_at: a.lastFeedSyncAt?.toISOString() ?? null,
    currency: a.currency,
    cdr_account_id: a.cdrAccountId,
  };
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const ownerIds = await workspaceOwnerIds(scope.userId);
    const rows = await prisma.bankAccount.findMany({
      where: { isActive: true, ...bankAccountOwnerFilter(ownerIds) },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(rows.map(toApi));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const body = (await request.json()) as {
      account_name?: string;
      account_number?: string;
      bsb?: string;
      bank_name?: string;
      account_type?: string;
      feed_provider?: string;
      is_active?: boolean;
    };

    const row = await prisma.bankAccount.create({
      data: {
        ownerUserId: scope.userId,
        accountName: String(body.account_name ?? ''),
        accountNumber: String(body.account_number ?? ''),
        bsb: String(body.bsb ?? ''),
        bankName: String(body.bank_name ?? ''),
        accountType: String(body.account_type ?? 'checking'),
        feedProvider: String(body.feed_provider ?? 'manual'),
        isActive: body.is_active !== false,
      },
    });
    return NextResponse.json(toApi(row), { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
