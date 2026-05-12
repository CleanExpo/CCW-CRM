import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';

export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

  return NextResponse.json({
    reminders_created: 0,
    message: 'No workshop reminder engine configured yet.',
  });
}
