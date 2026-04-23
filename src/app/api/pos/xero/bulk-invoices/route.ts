import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

/** Stub Xero bulk export: counts pending POS transactions (no external call). */
export async function POST() {
  try {
    const pending = await prisma.posTransaction.count({
      where: { reconciliationStatus: 'pending' },
    });
    return NextResponse.json({
      total: pending,
      created: 0,
      failed: 0,
      message:
        pending > 0
          ? `${pending} POS transaction(s) eligible for invoice export (connect Xero to sync).`
          : 'No pending POS transactions.',
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
