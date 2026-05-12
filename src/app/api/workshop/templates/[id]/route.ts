import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const scope = await requireAuthScope(request);
  if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

  await context.params;
  return NextResponse.json({ detail: 'Template not found' }, { status: 404 });
}
