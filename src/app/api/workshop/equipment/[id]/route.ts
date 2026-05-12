import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const scope = await requireAuthScope(request);
  if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

  await context.params;
  return NextResponse.json(
    { detail: 'Equipment not found. Registry is empty until workshop data is configured.' },
    { status: 404 }
  );
}
