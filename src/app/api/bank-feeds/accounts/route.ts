import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import type { BankAccount as BankAccountRow } from '@prisma/client';

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
    last_feed_sync_at: null as string | null,
  };
}

async function ensureDemoBankAccount() {
  const count = await prisma.bankAccount.count();
  if (count > 0) return;
  const account = await prisma.bankAccount.create({
    data: {
      accountName: 'Operating — Demo',
      accountNumber: '1001',
      bsb: '123-456',
      bankName: 'Demo Bank',
      accountType: 'checking',
      feedProvider: 'manual',
      locationCode: 'brisbane',
    },
  });
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  await prisma.bankFeedTransaction.createMany({
    data: [
      {
        bankAccountId: account.id,
        transactionDate: new Date(day.getTime() - 2 * 86400000),
        description: 'POS settlement demo',
        reference: 'REF-DEMO-001',
        credit: 129.9,
        debit: null,
        balance: 10000,
        reconciled: false,
      },
      {
        bankAccountId: account.id,
        transactionDate: new Date(day.getTime() - 1 * 86400000),
        description: 'Card batch',
        reference: 'REF-DEMO-002',
        credit: 54.5,
        debit: null,
        balance: 10054.5,
        reconciled: false,
      },
    ],
  });
}

export async function GET() {
  try {
    await ensureDemoBankAccount();
    const rows = await prisma.bankAccount.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(rows.map(toApi));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
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
