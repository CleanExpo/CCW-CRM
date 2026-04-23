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

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const row = await prisma.bankAccount.update({
      where: { id },
      data: {
        accountName: body.account_name != null ? String(body.account_name) : undefined,
        accountNumber: body.account_number != null ? String(body.account_number) : undefined,
        bsb: body.bsb != null ? String(body.bsb) : undefined,
        bankName: body.bank_name != null ? String(body.bank_name) : undefined,
        accountType: body.account_type != null ? String(body.account_type) : undefined,
        feedProvider: body.feed_provider != null ? String(body.feed_provider) : undefined,
        isActive: typeof body.is_active === 'boolean' ? body.is_active : undefined,
      },
    });
    return NextResponse.json(toApi(row));
  } catch {
    return NextResponse.json({ detail: 'Not found' }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await prisma.bankAccount.delete({ where: { id } });
    return NextResponse.json({ status: 'deleted' });
  } catch {
    return NextResponse.json({ detail: 'Not found' }, { status: 404 });
  }
}
