import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { prisma } from '@/lib/db/prisma';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // This endpoint MUTATES another tenant's lead. DemoRequest has no owner or workspace
    // column (UNI-2675), so the row cannot be tenant-filtered; until one exists, restrict
    // the write to platform admins. The gate precedes the body parse so an unauthenticated
    // caller is refused with 401 rather than a 400 about the payload.
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    if (!scope.isAdmin) {
      return NextResponse.json({ detail: 'Admin access required' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = (await request.json()) as { status?: string };
    const status = String(body.status ?? '');
    if (!status) {
      return NextResponse.json({ detail: 'status required' }, { status: 400 });
    }
    const row = await prisma.demoRequest.update({
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
