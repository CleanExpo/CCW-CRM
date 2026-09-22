import { requireAuthScope } from '@/lib/auth/data-scope';
import { buildPhase2Scope } from '@/lib/phase2/scope';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }
  if (scope.role === 'member') {
    return NextResponse.json({ detail: 'Your role does not have access to this resource' }, { status: 403 });
  }
  return NextResponse.json(await buildPhase2Scope(scope.userId));
}
