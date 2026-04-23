import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { status?: string };
    const status = String(body.status ?? '');
    if (!status) {
      return NextResponse.json({ detail: 'status required' }, { status: 400 });
    }
    const row = await prisma.contactSubmission.update({
      where: { id },
      data: { status },
    });
    return NextResponse.json({
      id: row.id,
      status: row.status,
      updated_at: row.updatedAt.toISOString(),
    });
  } catch {
    return NextResponse.json({ detail: 'Not found' }, { status: 404 });
  }
}
