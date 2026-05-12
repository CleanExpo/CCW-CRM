import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';

/**
 * SLA rules — reserved for future Prisma-backed rules.
 * Returns 200 + [] so CRM surfaces (Activities, Approvals, Tasks) never hit a 404.
 */
export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json([]);
}
