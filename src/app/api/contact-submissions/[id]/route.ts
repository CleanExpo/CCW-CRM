import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
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
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Admin-only for the same reason as the collection route: no tenant column to filter on.
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    if (!scope.isAdmin) {
      return NextResponse.json({ detail: 'Admin access required' }, { status: 403 });
    }

    const { id } = await context.params;
    const row = await prisma.contactSubmission.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    return NextResponse.json(rowToApi(row));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
