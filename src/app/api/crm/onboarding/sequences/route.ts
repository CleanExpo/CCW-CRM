import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { parsePagination } from '@/lib/workshop/pagination';

/** Onboarding email sequences — empty list until sequences are persisted. */
export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const { page, pageSize } = parsePagination(searchParams);

  return NextResponse.json({
    items: [],
    total: 0,
    page,
    page_size: pageSize,
    total_pages: 1,
  });
}
