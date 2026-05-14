import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { listGapsForUser } from '@/lib/integrations/cin7-shadow-sync-store';

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '20', 10) || 20));
  const entityType = searchParams.get('entity_type')?.trim() || undefined;
  const severity = searchParams.get('severity')?.trim() || undefined;
  return NextResponse.json(listGapsForUser(scope.userId, page, pageSize, entityType, severity));
}
