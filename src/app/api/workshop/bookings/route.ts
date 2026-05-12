import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { paginated, parsePagination } from '@/lib/workshop/pagination';

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const { page, pageSize } = parsePagination(searchParams);

  return NextResponse.json(paginated([], 0, page, pageSize));
}
