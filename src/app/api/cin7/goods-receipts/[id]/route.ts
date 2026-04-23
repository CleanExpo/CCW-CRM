import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { grnToApi } from '@/lib/db/grn-serialize';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const row = await prisma.goodsReceipt.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!row) return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    return NextResponse.json(grnToApi(row));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
