import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import {
  isCin7ReferenceListEntity,
  listCin7ReferenceData,
} from '@/lib/integrations/cin7-reference-list';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ entityType: string }> }
) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const { entityType } = await context.params;
  if (!isCin7ReferenceListEntity(entityType)) {
    return NextResponse.json({ detail: 'Unsupported reference entity type' }, { status: 400 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(Number(searchParams.get('page')) || 1, 1);
  const pageSize = Math.min(Math.max(Number(searchParams.get('page_size')) || 50, 1), 200);
  const search = searchParams.get('search')?.trim();

  const { items, total } = await listCin7ReferenceData(entityType, {
    ownerUserId: scope.userId,
    page,
    pageSize,
    search,
  });

  return NextResponse.json({
    entity: entityType,
    items,
    total,
    page,
    page_size: pageSize,
    total_pages: Math.ceil(total / pageSize) || 1,
  });
}
