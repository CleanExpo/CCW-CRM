import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

function rowToApi(s: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  source: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: s.id,
    name: s.name,
    email: s.email,
    phone: s.phone,
    subject: s.subject,
    message: s.message,
    source: s.source,
    status: s.status,
    created_at: s.createdAt.toISOString(),
    updated_at: s.updatedAt.toISOString(),
  };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const row = await prisma.contactSubmission.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    return NextResponse.json(rowToApi(row));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
