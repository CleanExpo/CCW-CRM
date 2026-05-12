import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';

/** Cancel an onboarding sequence — no-op success until sequences are stored in the database. */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const scope = await requireAuthScope(request);
  if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ detail: 'Missing sequence id' }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    id,
    message: 'No persisted sequences yet; nothing to cancel.',
  });
}
