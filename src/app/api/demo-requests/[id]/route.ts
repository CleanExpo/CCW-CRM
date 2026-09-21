import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { prisma } from '@/lib/db/prisma';

function rowToApi(r: {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  message: string | null;
  preferredDate: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: r.id,
    company_name: r.company ?? '',
    contact_name: r.name,
    email: r.email,
    phone: r.phone ?? '',
    product_interest: null as string | null,
    preferred_date: r.preferredDate?.toISOString() ?? null,
    notes: r.message ?? null,
    status: r.status,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // DemoRequest has no owner or workspace column, so this row cannot be
    // tenant-filtered. Until one exists (UNI-2675), restrict to platform admins rather
    // than let any authenticated user of any workspace read another workspace's lead.
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    if (!scope.isAdmin) {
      return NextResponse.json({ detail: 'Admin access required' }, { status: 403 });
    }

    const { id } = await context.params;
    const row = await prisma.demoRequest.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    return NextResponse.json(rowToApi(row));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
