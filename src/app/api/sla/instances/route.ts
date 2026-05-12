import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';

/**
 * SLA instances — reserved for future persistence.
 * Honors query params for compatibility; always returns 200 + [] so the UI stays clean
 * and the dev server does not log 404s for entity_type=activity|approval|task.
 */
export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json([]);
}
