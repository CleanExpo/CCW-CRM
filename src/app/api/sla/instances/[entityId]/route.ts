import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';

/**
 * SLA instances for a single entity — stub until SLA rows exist in the database.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ entityId: string }> }
) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }
  await context.params;
  return NextResponse.json([]);
}
