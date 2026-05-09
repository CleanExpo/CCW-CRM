import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import type { BankAccount as BankAccountRow } from '@prisma/client';
import { requireAuthScope } from '@/lib/auth/data-scope';

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
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;
    const existing = await prisma.bankAccount.findFirst({
      where: { id, ownerUserId: scope.userId },
    });
    if (!existing) {
      return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    }

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
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;
    const del = await prisma.bankAccount.deleteMany({
      where: { id, ownerUserId: scope.userId },
    });
    if (del.count === 0) {
      return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ status: 'deleted' });
  } catch {
    return NextResponse.json({ detail: 'Not found' }, { status: 404 });
  }
}
